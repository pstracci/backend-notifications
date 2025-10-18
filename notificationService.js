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
 * Remove tokens inválidos do banco de dados
 * @param {Object} db - Instância do banco de dados
 * @param {Array} invalidTokens - Array de tokens inválidos
 */
async function removeInvalidTokens(db, invalidTokens) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  
  try {
    const placeholders = invalidTokens.map((_, index) => `$${index + 1}`).join(', ');
    const query = `DELETE FROM devices WHERE token IN (${placeholders})`;
    
    const result = await db.query(query, invalidTokens);
    console.log(`🗑️ Removidos ${result.rowCount} token(s) inválido(s) do banco de dados`);
  } catch (error) {
    console.error('Erro ao remover tokens inválidos:', error);
  }
}

/**
 * Verifica se um usuário está em cooldown para uma localização (última notificação foi há menos de 1 hora)
 * @param {Object} db - Instância do banco de dados
 * @param {number} userId - ID do usuário
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise<boolean>} True se está em cooldown, False caso contrário
 */
async function isUserLocationInCooldown(db, userId, latitude, longitude) {
  try {
    const query = `
      SELECT last_notification_at
      FROM notification_cooldown
      WHERE user_id = $1 AND latitude = $2 AND longitude = $3
        AND last_notification_at > NOW() - INTERVAL '1 hour'
    `;
    
    const { rows } = await db.query(query, [userId, latitude, longitude]);
    
    if (rows.length > 0) {
      const lastNotification = new Date(rows[0].last_notification_at);
      const minutesAgo = Math.floor((Date.now() - lastNotification.getTime()) / 1000 / 60);
      console.log(`⏳ Usuário ${userId} em cooldown para ${latitude}, ${longitude} (última notificação há ${minutesAgo} minutos)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar cooldown:', error);
    return false; // Em caso de erro, permite enviar notificação
  }
}

/**
 * Registra que uma notificação foi enviada para um usuário em uma localização
 * @param {Object} db - Instância do banco de dados
 * @param {number} userId - ID do usuário
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @param {string} intensityLevel - Nível de intensidade
 * @param {number} precipitation - Precipitação em mm/h
 */
async function recordNotificationSent(db, userId, latitude, longitude, intensityLevel, precipitation) {
  try {
    const query = `
      INSERT INTO notification_cooldown (user_id, latitude, longitude, intensity_level, precipitation, last_notification_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, latitude, longitude)
      DO UPDATE SET
        last_notification_at = NOW(),
        intensity_level = $4,
        precipitation = $5
    `;
    
    await db.query(query, [userId, latitude, longitude, intensityLevel, precipitation]);
    console.log(`📝 Cooldown registrado para usuário ${userId} em ${latitude}, ${longitude}`);
  } catch (error) {
    console.error('Erro ao registrar cooldown:', error);
  }
}

/**
 * Obtém tokens de dispositivos e IDs de usuários para usuários específicos
 * @param {Object} db - Instância do banco de dados
 * @param {Array} userUids - Array de UIDs de usuários
 * @returns {Promise<Array>} Array de objetos {userId, token}
 */
async function getDeviceTokensForUsers(db, userUids) {
  try {
    if (!userUids || userUids.length === 0) {
      return [];
    }

    // Criar placeholders para a query ($1, $2, $3, ...)
    const placeholders = userUids.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      SELECT DISTINCT u.id as user_id, d.token
      FROM devices d
      INNER JOIN users u ON d.user_id = u.id
      WHERE u.uid IN (${placeholders})
        AND d.token IS NOT NULL
    `;

    const { rows } = await db.query(query, userUids);
    
    return rows.map(row => ({
      userId: row.user_id,
      token: row.token
    }));

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
async function sendRainNotification(tokens, intensityLevel, precipitation, location, db) {
  if (!tokens || tokens.length === 0) {
    console.log('Nenhum token disponível para enviar notificação');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
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
    
    // Identificar e remover tokens inválidos
    const invalidTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.error(`Erro no token ${idx + 1}:`, errorCode, resp.error?.message);
          
          // Tokens que devem ser removidos do banco
          if (errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/invalid-argument') {
            invalidTokens.push(tokens[idx]);
          }
        }
      });
      
      // Remover tokens inválidos do banco de dados
      if (invalidTokens.length > 0 && db) {
        await removeInvalidTokens(db, invalidTokens);
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: invalidTokens,
      responses: response.responses
    };

  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [], error: error.message };
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
  let totalSkippedUsers = 0;

  for (const forecast of forecasts) {
    console.log(`\n--- Processando localização: ${forecast.latitude}, ${forecast.longitude} ---`);
    console.log(`Intensidade: ${forecast.intensityLevel} (${forecast.maxPrecipitation.toFixed(2)} mm/h)`);
    console.log(`Usuários afetados: ${forecast.userCount}`);

    // Obter tokens e IDs dos usuários nesta localização
    const userDevices = await getDeviceTokensForUsers(db, forecast.userUids);
    
    if (userDevices.length === 0) {
      console.log('⚠️ Nenhum dispositivo registrado para os usuários desta localização');
      continue;
    }

    // Filtrar usuários que NÃO estão em cooldown
    const devicesToNotify = [];
    let skippedInLocation = 0;

    for (const device of userDevices) {
      const inCooldown = await isUserLocationInCooldown(
        db, 
        device.userId, 
        forecast.latitude, 
        forecast.longitude
      );
      
      if (!inCooldown) {
        devicesToNotify.push(device);
      } else {
        skippedInLocation++;
      }
    }

    console.log(`📱 ${devicesToNotify.length} usuário(s) para notificar, ${skippedInLocation} em cooldown`);
    totalSkippedUsers += skippedInLocation;

    if (devicesToNotify.length === 0) {
      console.log('⏭️ Todos os usuários desta localização estão em cooldown');
      results.push({
        location: `${forecast.latitude}, ${forecast.longitude}`,
        intensity: forecast.intensityLevel,
        precipitation: forecast.maxPrecipitation,
        userCount: forecast.userCount,
        devicesNotified: 0,
        devicesFailed: 0,
        skipped: true,
        reason: 'all_users_in_cooldown'
      });
      continue;
    }

    // Enviar notificação apenas para os tokens dos usuários sem cooldown
    const tokensToSend = devicesToNotify.map(d => d.token);
    const result = await sendRainNotification(
      tokensToSend,
      forecast.intensityLevel,
      forecast.maxPrecipitation,
      { latitude: forecast.latitude, longitude: forecast.longitude },
      db
    );

    // Registrar cooldown para cada usuário que recebeu notificação com sucesso
    if (result.successCount > 0) {
      for (let i = 0; i < devicesToNotify.length; i++) {
        // Verificar se a notificação foi enviada com sucesso para este token
        if (result.responses[i]?.success) {
          await recordNotificationSent(
            db,
            devicesToNotify[i].userId,
            forecast.latitude,
            forecast.longitude,
            forecast.intensityLevel,
            forecast.maxPrecipitation
          );
        }
      }
    }

    totalSuccessCount += result.successCount;
    totalFailureCount += result.failureCount;

    results.push({
      location: `${forecast.latitude}, ${forecast.longitude}`,
      intensity: forecast.intensityLevel,
      precipitation: forecast.maxPrecipitation,
      userCount: forecast.userCount,
      devicesNotified: result.successCount,
      devicesFailed: result.failureCount,
      usersSkipped: skippedInLocation,
      skipped: false
    });
  }

  const summary = {
    totalNotifications: totalSuccessCount,
    totalFailures: totalFailureCount,
    locationsProcessed: forecasts.length,
    usersSkipped: totalSkippedUsers,
    results: results
  };

  console.log('\n=== RESUMO DO PROCESSAMENTO ===');
  console.log(`Localizações processadas: ${summary.locationsProcessed}`);
  console.log(`Usuários pulados (cooldown): ${summary.usersSkipped}`);
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
