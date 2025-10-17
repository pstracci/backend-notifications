// weatherService.js
// Serviço para consultar a API do Tomorrow.io e obter previsões de precipitação

const axios = require('axios');
const rateLimiter = require('./rateLimiter');

const TOMORROW_API_KEY = 'vVizCi26cu5mljLrkFFvQxEg6V1OBNqF';
const TOMORROW_API_URL = 'https://api.tomorrow.io/v4/timelines';

/**
 * Arredonda coordenadas para 2 casas decimais
 * @param {number} coord - Coordenada (latitude ou longitude)
 * @returns {number} Coordenada arredondada
 */
function roundCoordinate(coord) {
  return Math.round(coord * 100) / 100;
}

/**
 * Determina o nível de intensidade da chuva baseado na precipitação
 * @param {number} precipitationIntensity - Intensidade de precipitação em mm/h
 * @returns {string} Nível: 'none', 'light', 'moderate', 'heavy', 'extreme'
 */
function getRainIntensityLevel(precipitationIntensity) {
  if (precipitationIntensity === 0 || precipitationIntensity < 0.1) {
    return 'none';
  } else if (precipitationIntensity < 2.5) {
    return 'light'; // Chuva fraca
  } else if (precipitationIntensity < 10) {
    return 'moderate'; // Chuva moderada
  } else if (precipitationIntensity < 50) {
    return 'heavy'; // Chuva forte
  } else {
    return 'extreme'; // Chuva extrema
  }
}

/**
 * Consulta a previsão de precipitação para uma localização específica
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise<Object>} Objeto com informações da previsão
 */
async function getWeatherForecast(latitude, longitude) {
  try {
    // Verificar se pode fazer requisição
    const check = rateLimiter.canMakeRequest();
    if (!check.allowed) {
      console.warn(`⚠️ Rate limit atingido: ${check.reason}`);
      console.warn(`   Aguardando ${Math.ceil(check.waitTime / 1000)}s...`);
      
      // Aguardar até que seja possível fazer a requisição
      const canProceed = await rateLimiter.waitUntilAllowed(check.waitTime + 1000);
      if (!canProceed) {
        console.error('❌ Não foi possível fazer requisição devido ao rate limit');
        return null;
      }
    }
    
    const params = {
      location: `${latitude},${longitude}`,
      fields: ['precipitationIntensity', 'precipitationProbability'],
      timesteps: ['1m'], // Minutely (próximos minutos)
      units: 'metric',
      apikey: TOMORROW_API_KEY
    };

    console.log(`Consultando previsão para: ${latitude}, ${longitude}`);
    
    // Registrar requisição
    rateLimiter.recordRequest();
    
    const response = await axios.get(TOMORROW_API_URL, { params });
    
    if (!response.data || !response.data.data || !response.data.data.timelines) {
      console.error('Resposta da API inválida:', response.data);
      return null;
    }

    const timeline = response.data.data.timelines[0];
    const intervals = timeline.intervals;

    // Analisar os próximos 30 minutos
    const next30Minutes = intervals.slice(0, 30);
    
    // Encontrar a maior intensidade de precipitação nos próximos 30 minutos
    let maxPrecipitation = 0;
    let maxProbability = 0;
    let timeOfMaxPrecipitation = null;

    next30Minutes.forEach(interval => {
      const precipitation = interval.values.precipitationIntensity || 0;
      const probability = interval.values.precipitationProbability || 0;
      
      if (precipitation > maxPrecipitation) {
        maxPrecipitation = precipitation;
        maxProbability = probability;
        timeOfMaxPrecipitation = interval.startTime;
      }
    });

    const intensityLevel = getRainIntensityLevel(maxPrecipitation);

    return {
      latitude,
      longitude,
      maxPrecipitation,
      maxProbability,
      intensityLevel,
      timeOfMaxPrecipitation,
      shouldNotify: intensityLevel !== 'none' && maxProbability > 30 // Notificar se probabilidade > 30%
    };

  } catch (error) {
    console.error(`Erro ao consultar API do Tomorrow.io para ${latitude}, ${longitude}:`, error.message);
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
    }
    return null;
  }
}

/**
 * Obtém localizações únicas (arredondadas) do banco de dados
 * @param {Object} db - Instância do banco de dados
 * @returns {Promise<Array>} Array de localizações únicas com usuários
 */
async function getUniqueLocations(db) {
  try {
    const query = `
      SELECT 
        ROUND(CAST(latitude AS numeric), 2) as rounded_lat,
        ROUND(CAST(longitude AS numeric), 2) as rounded_lon,
        array_agg(DISTINCT uid) as user_uids,
        COUNT(DISTINCT uid) as user_count
      FROM users
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY rounded_lat, rounded_lon
      ORDER BY user_count DESC
    `;

    const { rows } = await db.query(query);
    
    console.log(`Encontradas ${rows.length} localizações únicas no banco de dados`);
    
    return rows.map(row => ({
      latitude: parseFloat(row.rounded_lat),
      longitude: parseFloat(row.rounded_lon),
      userUids: row.user_uids,
      userCount: parseInt(row.user_count)
    }));

  } catch (error) {
    console.error('Erro ao buscar localizações únicas:', error);
    return [];
  }
}

/**
 * Verifica previsão de chuva para todas as localizações únicas
 * @param {Object} db - Instância do banco de dados
 * @returns {Promise<Array>} Array de previsões por localização
 */
async function checkRainForAllLocations(db) {
  const locations = await getUniqueLocations(db);
  
  if (locations.length === 0) {
    console.log('Nenhuma localização encontrada no banco de dados');
    return [];
  }

  console.log(`Verificando previsão para ${locations.length} localizações...`);
  
  // Verificar limites antes de começar
  const stats = rateLimiter.getStats();
  console.log('\n📊 Status do Rate Limiter:');
  console.log(`   Por segundo: ${stats.perSecond.current}/${stats.perSecond.limit} (${stats.perSecond.percentage}%)`);
  console.log(`   Por hora: ${stats.perHour.current}/${stats.perHour.limit} (${stats.perHour.percentage}%)`);
  console.log(`   Por dia: ${stats.perDay.current}/${stats.perDay.limit} (${stats.perDay.percentage}%)\n`);
  
  const maxAllowed = rateLimiter.getMaxAllowedRequests();
  if (maxAllowed === 0) {
    console.error('❌ Limite de requisições da API atingido. Não é possível fazer mais consultas no momento.');
    return [];
  }
  
  if (locations.length > maxAllowed) {
    console.warn(`⚠️ ATENÇÃO: ${locations.length} localizações encontradas, mas apenas ${maxAllowed} requisições disponíveis.`);
    console.warn(`   Processando apenas as ${maxAllowed} primeiras localizações (ordenadas por número de usuários).`);
  }
  
  // Calcular delay ideal entre requisições
  const locationsToProcess = Math.min(locations.length, maxAllowed);
  const optimalDelay = rateLimiter.calculateOptimalDelay(locationsToProcess);
  console.log(`⏱️ Delay calculado entre requisições: ${optimalDelay}ms\n`);
  
  const forecasts = [];
  let processedCount = 0;
  
  // Processar localizações respeitando os limites
  for (let i = 0; i < locationsToProcess; i++) {
    const location = locations[i];
    
    console.log(`[${i + 1}/${locationsToProcess}] Processando ${location.latitude}, ${location.longitude} (${location.userCount} usuários)`);
    
    const forecast = await getWeatherForecast(location.latitude, location.longitude);
    
    if (forecast && forecast.shouldNotify) {
      forecasts.push({
        ...forecast,
        userUids: location.userUids,
        userCount: location.userCount
      });
      
      console.log(`   ⚠️ Chuva detectada: ${forecast.intensityLevel} (${forecast.maxPrecipitation.toFixed(2)} mm/h)`);
    } else if (forecast) {
      console.log(`   ✅ Sem chuva significativa`);
    } else {
      console.log(`   ❌ Erro ao consultar previsão`);
    }
    
    processedCount++;
    
    // Aguardar delay entre requisições (exceto na última)
    if (i < locationsToProcess - 1) {
      await new Promise(resolve => setTimeout(resolve, optimalDelay));
    }
  }
  
  console.log(`\n✅ Processamento concluído: ${processedCount}/${locations.length} localizações verificadas`);
  console.log(`   Localizações com chuva: ${forecasts.length}`);
  
  // Mostrar estatísticas finais
  const finalStats = rateLimiter.getStats();
  console.log('\n📊 Status Final do Rate Limiter:');
  console.log(`   Por hora: ${finalStats.perHour.current}/${finalStats.perHour.limit} (${finalStats.perHour.percentage}%)`);
  console.log(`   Por dia: ${finalStats.perDay.current}/${finalStats.perDay.limit} (${finalStats.perDay.percentage}%)`);

  return forecasts;
}

module.exports = {
  roundCoordinate,
  getRainIntensityLevel,
  getWeatherForecast,
  getUniqueLocations,
  checkRainForAllLocations,
  getRateLimiterStats: () => rateLimiter.getStats()
};
