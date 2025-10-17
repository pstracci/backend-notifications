// notificationService.js
// Serviço para gerenciar envio de notificações com diferentes intensidades

const admin = require('./firebase-config');

/**
 * Obtém configuração de notificação baseada na intensidade da chuva
 * @param {string} intensityLevel - Nível de intensidade: 'light', 'moderate', 'heavy', 'extreme'
 * @param {number} precipitation - Valor de precipitação em mm/h
 * @returns {Object} Configuração da notificação
 */
function getNotificationConfig(intensityLevel, precipitation) {
  const configs = {
    light: {
      title: '🌦️ Chuva Fraca se Aproximando',
      body: `Chuva leve prevista nos próximos 30 minutos (${precipitation.toFixed(1)} mm/h). Leve um guarda-chuva!`,
      priority: 'normal',
      // Vibração: padrão curto [duração, pausa, duração]
      vibrationPattern: [200, 100, 200],
      sound: 'default'
    },
    moderate: {
      title: '🌧️ Chuva Moderada se Aproximando',
      body: `Chuva moderada prevista nos próximos 30 minutos (${precipitation.toFixed(1)} mm/h). Prepare-se!`,
      priority: 'high',
      // Vibração: padrão médio
      vibrationPattern: [300, 150, 300, 150, 300],
      sound: 'default'
    },
    heavy: {
      title: '⛈️ CHUVA FORTE se Aproximando!',
      body: `ATENÇÃO: Chuva forte prevista nos próximos 30 minutos (${precipitation.toFixed(1)} mm/h). Busque abrigo!`,
      priority: 'high',
      // Vibração: padrão intenso
      vibrationPattern: [400, 200, 400, 200, 400, 200, 400],
      sound: 'default'
    },
    extreme: {
      title: '🚨 ALERTA: CHUVA EXTREMA!',
      body: `ALERTA MÁXIMO: Chuva extrema prevista nos próximos 30 minutos (${precipitation.toFixed(1)} mm/h). BUSQUE ABRIGO IMEDIATAMENTE!`,
      priority: 'high',
      // Vibração: padrão muito intenso
      vibrationPattern: [500, 250, 500, 250, 500, 250, 500, 250, 500],
      sound: 'default'
    }
  };

  return configs[intensityLevel] || configs.moderate;
}

/**
 * Obtém tokens de dispositivos para usuários específicos
 * @param {Object} db - Instância do banco de dados
 * @param {Array} userUids - Array de UIDs de usuários
 * @returns {Promise<Array>} Array de tokens
 */
async function getDeviceTokensForUsers(db, userUids) {
  try {
    if (!userUids || userUids.length === 0) {
      return [];
    }

    // Criar placeholders para a query ($1, $2, $3, ...)
    const placeholders = userUids.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      SELECT DISTINCT d.token
      FROM devices d
      INNER JOIN users u ON d.token IS NOT NULL
      WHERE u.uid IN (${placeholders})
        AND d.token IS NOT NULL
    `;

    const { rows } = await db.query(query, userUids);
    
    return rows.map(row => row.token);

  } catch (error) {
    console.error('Erro ao buscar tokens de dispositivos:', error);
    return [];
  }
}

/**
 * Envia notificação para dispositivos específicos
 * @param {Array} tokens - Array de tokens de dispositivos
 * @param {string} intensityLevel - Nível de intensidade da chuva
 * @param {number} precipitation - Valor de precipitação
 * @param {Object} location - Objeto com latitude e longitude
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendRainNotification(tokens, intensityLevel, precipitation, location) {
  if (!tokens || tokens.length === 0) {
    console.log('Nenhum token disponível para enviar notificação');
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const config = getNotificationConfig(intensityLevel, precipitation);
    
    // Construir mensagem para Firebase Cloud Messaging
    const message = {
      notification: {
        title: config.title,
        body: config.body
      },
      android: {
        priority: config.priority,
        notification: {
          channelId: 'rain_alerts',
          defaultSound: true,
          defaultVibrateTimings: false,
          vibrateTimingsMillis: config.vibrationPattern,
          tag: `rain_${location.latitude}_${location.longitude}` // Evita notificações duplicadas
        }
      },
      apns: {
        payload: {
          aps: {
            sound: config.sound,
            badge: 1
          }
        }
      },
      data: {
        type: 'rain_alert',
        intensity: intensityLevel,
        precipitation: precipitation.toString(),
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        vibrationPattern: JSON.stringify(config.vibrationPattern)
      }
    };

    console.log(`Enviando notificação de ${intensityLevel} para ${tokens.length} dispositivo(s)...`);
    
    const response = await admin.messaging().sendEachForMulticast({
      ...message,
      tokens: tokens
    });

    console.log(`✅ Notificações enviadas: ${response.successCount} sucesso, ${response.failureCount} falhas`);
    
    // Log de erros detalhados
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Erro no token ${idx + 1}:`, resp.error?.code, resp.error?.message);
        }
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };

  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return { successCount: 0, failureCount: tokens.length, error: error.message };
  }
}

/**
 * Processa previsões e envia notificações para localizações afetadas
 * @param {Object} db - Instância do banco de dados
 * @param {Array} forecasts - Array de previsões com informações de chuva
 * @returns {Promise<Object>} Resumo do processamento
 */
async function processRainForecasts(db, forecasts) {
  if (!forecasts || forecasts.length === 0) {
    console.log('Nenhuma previsão de chuva para processar');
    return { totalNotifications: 0, totalUsers: 0, locations: [] };
  }

  console.log(`Processando ${forecasts.length} previsão(ões) de chuva...`);
  
  const results = [];
  let totalSuccessCount = 0;
  let totalFailureCount = 0;

  for (const forecast of forecasts) {
    console.log(`\n--- Processando localização: ${forecast.latitude}, ${forecast.longitude} ---`);
    console.log(`Intensidade: ${forecast.intensityLevel} (${forecast.maxPrecipitation.toFixed(2)} mm/h)`);
    console.log(`Usuários afetados: ${forecast.userCount}`);

    // Obter tokens dos dispositivos dos usuários nesta localização
    const tokens = await getDeviceTokensForUsers(db, forecast.userUids);
    
    if (tokens.length === 0) {
      console.log('⚠️ Nenhum dispositivo registrado para os usuários desta localização');
      continue;
    }

    // Enviar notificação
    const result = await sendRainNotification(
      tokens,
      forecast.intensityLevel,
      forecast.maxPrecipitation,
      { latitude: forecast.latitude, longitude: forecast.longitude }
    );

    totalSuccessCount += result.successCount;
    totalFailureCount += result.failureCount;

    results.push({
      location: `${forecast.latitude}, ${forecast.longitude}`,
      intensity: forecast.intensityLevel,
      precipitation: forecast.maxPrecipitation,
      userCount: forecast.userCount,
      devicesNotified: result.successCount,
      devicesFailed: result.failureCount
    });
  }

  const summary = {
    totalNotifications: totalSuccessCount,
    totalFailures: totalFailureCount,
    locationsProcessed: forecasts.length,
    results: results
  };

  console.log('\n=== RESUMO DO PROCESSAMENTO ===');
  console.log(`Localizações processadas: ${summary.locationsProcessed}`);
  console.log(`Notificações enviadas com sucesso: ${summary.totalNotifications}`);
  console.log(`Falhas no envio: ${summary.totalFailures}`);

  return summary;
}

module.exports = {
  getNotificationConfig,
  getDeviceTokensForUsers,
  sendRainNotification,
  processRainForecasts
};
