// weatherService.js
// Serviço para consultar a API do Open-Meteo e obter alertas meteorológicos

const axios = require('axios');

// Open-Meteo API - GRATUITA e sem necessidade de API key!
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/**
 * Arredonda coordenadas para agrupar usuários próximos
 * Arredonda para 0.01° (~1.1km de precisão) - API gratuita permite maior precisão!
 * @param {number} coord - Coordenada (latitude ou longitude)
 * @returns {number} Coordenada arredondada
 */
function roundCoordinate(coord) {
  return Math.round(coord * 100) / 100; // 0.01° de precisão (~1.1km)
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
 * Determina o nível de alerta UV
 */
function getUVLevel(uvIndex) {
  if (uvIndex < 3) return { level: 'low', shouldAlert: false };
  if (uvIndex < 6) return { level: 'moderate', shouldAlert: false };
  if (uvIndex < 8) return { level: 'high', shouldAlert: true };
  if (uvIndex < 11) return { level: 'very_high', shouldAlert: true };
  return { level: 'extreme', shouldAlert: true };
}

/**
 * Determina o nível de qualidade do ar
 */
function getAirQualityLevel(aqi) {
  if (aqi <= 20) return { level: 'good', shouldAlert: false, description: 'Boa' };
  if (aqi <= 40) return { level: 'fair', shouldAlert: false, description: 'Razoável' };
  if (aqi <= 60) return { level: 'moderate', shouldAlert: true, description: 'Moderada' };
  if (aqi <= 80) return { level: 'poor', shouldAlert: true, description: 'Ruim' };
  if (aqi <= 100) return { level: 'very_poor', shouldAlert: true, description: 'Muito Ruim' };
  return { level: 'extremely_poor', shouldAlert: true, description: 'Extremamente Ruim' };
}

/**
 * Determina o nível de alerta de vento
 */
function getWindLevel(windSpeed, windGusts) {
  const maxWind = Math.max(windSpeed, windGusts || 0);
  if (maxWind < 50) return { level: 'calm', shouldAlert: false };
  if (maxWind < 70) return { level: 'strong', shouldAlert: true, description: 'Vento forte' };
  return { level: 'very_strong', shouldAlert: true, description: 'Vento muito forte' };
}

/**
 * Consulta dados meteorológicos completos para uma localização
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise<Object>} Objeto com todos os alertas meteorológicos
 */
async function getWeatherAlerts(latitude, longitude) {
  try {
    console.log(`🌍 Consultando dados para: ${latitude}, ${longitude}`);
    
    // Fazer requisições em paralelo
    const [weatherResponse, airQualityResponse] = await Promise.all([
      axios.get(OPEN_METEO_URL, {
        params: {
          latitude, longitude,
          current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
          hourly: 'precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
          forecast_days: 1,
          timezone: 'auto'
        }
      }),
      axios.get(AIR_QUALITY_URL, {
        params: { latitude, longitude, current: 'european_aqi,pm10,pm2_5', timezone: 'auto' }
      }).catch(() => null)
    ]);

    if (!weatherResponse.data) return null;

    const current = weatherResponse.data.current;
    const hourly = weatherResponse.data.hourly;
    const alerts = [];

    // ALERTA 1: CHUVA AGORA
    if (current.precipitation > 0 || current.rain > 0) {
      const rain = current.precipitation || current.rain;
      const level = getRainIntensityLevel(rain);
      alerts.push({
        type: 'rain_now', severity: level, value: rain,
        message: `Está chovendo agora (${rain.toFixed(1)} mm)`,
        shouldNotify: level !== 'none'
      });
    }

    const currentHour = new Date(current.time).getHours();
    const currentHourIndex = currentHour; // Array começa em 0 para 00:00

    // ALERTA 2: PREVISÃO DE CHUVA (3h)
    const next3h = hourly.precipitation.slice(currentHourIndex, currentHourIndex + 3);
    const maxRain = Math.max(...next3h);
    if (maxRain > 0.5) {
      const level = getRainIntensityLevel(maxRain);
      const hour = next3h.indexOf(maxRain) + 1;
      alerts.push({
        type: 'rain_forecast', severity: level, value: maxRain, hoursAhead: hour,
        message: `Chuva prevista em ${hour}h (${maxRain.toFixed(1)} mm)`,
        shouldNotify: level !== 'none'
      });
    }

    // ALERTA 3: UV ALTO
    const uv = current.uv_index || 0;
    const uvLevel = getUVLevel(uv);
    if (uvLevel.shouldAlert) {
      alerts.push({
        type: 'uv_high', severity: uvLevel.level, value: uv,
        message: `Índice UV ${uvLevel.level === 'extreme' ? 'EXTREMO' : 'ALTO'}: ${uv.toFixed(1)}`,
        shouldNotify: true
      });
    }

    // ALERTA 4: QUALIDADE DO AR
    if (airQualityResponse?.data) {
      const aqi = airQualityResponse.data.current.european_aqi;
      const aqLevel = getAirQualityLevel(aqi);
      if (aqLevel.shouldAlert) {
        alerts.push({
          type: 'air_quality', severity: aqLevel.level, value: aqi,
          description: aqLevel.description,
          message: `Qualidade do ar ${aqLevel.description} (AQI: ${aqi})`,
          shouldNotify: true
        });
      }
    }

    // ALERTA 5: VENTO FORTE
    const wind = current.wind_speed_10m || 0;
    const gusts = current.wind_gusts_10m || 0;
    const windLevel = getWindLevel(wind, gusts);
    if (windLevel.shouldAlert) {
      const maxWind = Math.max(wind, gusts);
      alerts.push({
        type: 'wind', severity: windLevel.level, value: maxWind,
        windSpeed: wind, windGusts: gusts,
        message: `${windLevel.description}: ${maxWind.toFixed(0)} km/h`,
        shouldNotify: true
      });
    }

    // ALERTA 6: RAJADAS PREVISTAS
    const next3hGusts = hourly.wind_gusts_10m.slice(currentHourIndex, currentHourIndex + 3);
    const maxGusts = Math.max(...next3hGusts);
    if (maxGusts >= 60 && !windLevel.shouldAlert) {
      const hour = next3hGusts.indexOf(maxGusts) + 1;
      alerts.push({
        type: 'wind_forecast', severity: 'strong', value: maxGusts, hoursAhead: hour,
        message: `Rajadas fortes previstas em ${hour}h (${maxGusts.toFixed(0)} km/h)`,
        shouldNotify: true
      });
    }

    return {
      latitude, longitude,
      alerts: alerts.filter(a => a.shouldNotify),
      allAlerts: alerts,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Erro ao consultar API para ${latitude}, ${longitude}:`, error.message);
    return null;
  }
}

/**
 * Obtém localizações únicas (arredondadas) do banco de dados
 * Precisão de ~1.1km (0.01°)
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
    
    console.log(`📍 Encontradas ${rows.length} localizações únicas no banco de dados`);
    
    return rows.map(row => ({
      latitude: parseFloat(row.rounded_lat),
      longitude: parseFloat(row.rounded_lon),
      userUids: row.user_uids,
      userCount: parseInt(row.user_count)
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar localizações únicas:', error);
    return [];
  }
}

/**
 * Verifica alertas meteorológicos para todas as localizações únicas
 * @param {Object} db - Instância do banco de dados
 * @returns {Promise<Array>} Array de alertas por localização
 */
async function checkAlertsForAllLocations(db) {
  const locations = await getUniqueLocations(db);
  
  if (locations.length === 0) {
    console.log('❌ Nenhuma localização encontrada no banco de dados');
    return [];
  }

  console.log(`\n🔍 Verificando alertas para ${locations.length} localizações...`);
  console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}\n`);
  
  const locationAlerts = [];
  let processedCount = 0;
  
  // Open-Meteo é gratuito, mas vamos ser educados e adicionar pequeno delay
  const DELAY_MS = 100; // 100ms entre requisições
  
  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    
    console.log(`[${i + 1}/${locations.length}] 📍 ${location.latitude}, ${location.longitude} (${location.userCount} usuários)`);
    
    const result = await getWeatherAlerts(location.latitude, location.longitude);
    
    if (result && result.alerts.length > 0) {
      locationAlerts.push({
        ...result,
        userUids: location.userUids,
        userCount: location.userCount
      });
      
      console.log(`   ⚠️ ${result.alerts.length} alerta(s) detectado(s):`);
      result.alerts.forEach(alert => {
        console.log(`      - ${alert.type}: ${alert.message}`);
      });
    } else if (result) {
      console.log(`   ✅ Sem alertas`);
    } else {
      console.log(`   ❌ Erro ao consultar dados`);
    }
    
    processedCount++;
    
    // Pequeno delay entre requisições
    if (i < locations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log(`\n✅ Processamento concluído: ${processedCount}/${locations.length} localizações verificadas`);
  console.log(`   Localizações com alertas: ${locationAlerts.length}`);
  
  // Resumo de alertas por tipo
  const alertsByType = {};
  locationAlerts.forEach(loc => {
    loc.alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });
  });
  
  if (Object.keys(alertsByType).length > 0) {
    console.log('\n📊 Resumo de alertas por tipo:');
    Object.entries(alertsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  return locationAlerts;
}

module.exports = {
  roundCoordinate,
  getRainIntensityLevel,
  getUVLevel,
  getAirQualityLevel,
  getWindLevel,
  getWeatherAlerts,
  getUniqueLocations,
  checkAlertsForAllLocations
};
