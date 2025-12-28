// notificationService.js
// Serviço para gerenciar envio de notificações com diferentes intensidades

const admin = require('./firebase-config');
const { roundCoordinate } = require('./weatherService');

/**
 * Retorna o intervalo de cooldown em horas para cada tipo de alerta
 * @param {string} alertType - Tipo do alerta
 * @returns {number} Horas de cooldown
 */
function getCooldownHours(alertType) {
  // UV, qualidade do ar e vento: 6 horas
  if (['uv_high', 'air_quality', 'wind', 'wind_forecast'].includes(alertType)) {
    return 6;
  }
  // Chuva e outros: 1 hora
  return 1;
}

/**
 * Obtém configuração de notificação baseada no tipo e severidade do alerta
 * @param {Object} alert - Objeto do alerta contendo type, severity, value e message
 * @returns {Object} Configuração da notificação
 */
function getNotificationConfig(alert) {
  const { type, severity, value, message } = alert;
  
  // Configurações para alertas de chuva
  if (type === 'rain_now') {
    const rainConfigs = {
      light: {
        title: '🌦️ Light Rain Approaching',
        body: `Light rain expected in the next 30 minutes (${value.toFixed(1)} mm/h). Bring an umbrella!`,
        priority: 'normal',
        vibrationPattern: [200, 100, 200],
        sound: 'default'
      },
      moderate: {
        title: '🌧️ Moderate Rain Approaching',
        body: `Moderate rain expected in the next 30 minutes (${value.toFixed(1)} mm/h). Be prepared!`,
        priority: 'high',
        vibrationPattern: [300, 150, 300, 150, 300],
        sound: 'default'
      },
      heavy: {
        title: '⛈️ HEAVY RAIN Approaching!',
        body: `WARNING: Heavy rain expected in the next 30 minutes (${value.toFixed(1)} mm/h). Seek shelter!`,
        priority: 'high',
        vibrationPattern: [400, 200, 400, 200, 400, 200, 400],
        sound: 'default'
      },
      extreme: {
        title: '🚨 ALERT: EXTREME RAIN!',
        body: `MAXIMUM ALERT: Extreme rain expected in the next 30 minutes (${value.toFixed(1)} mm/h). SEEK SHELTER IMMEDIATELY!`,
        priority: 'high',
        vibrationPattern: [500, 250, 500, 250, 500, 250, 500, 250, 500],
        sound: 'default'
      }
    };
    return rainConfigs[severity] || rainConfigs.moderate;
  }
  
  // Configurações para alertas de qualidade do ar
  if (type === 'air_quality') {
    const airConfigs = {
      moderate: {
        title: '😷 Moderate Air Quality',
        body: message || `Moderate air quality (AQI: ${Math.round(value)}). Sensitive individuals should consider reducing outdoor activities.`,
        priority: 'normal',
        vibrationPattern: [200, 100, 200],
        sound: 'default'
      },
      poor: {
        title: '⚠️ Poor Air Quality',
        body: message || `Poor air quality (AQI: ${Math.round(value)}). Avoid prolonged outdoor activities.`,
        priority: 'high',
        vibrationPattern: [300, 150, 300, 150, 300],
        sound: 'default'
      },
      very_poor: {
        title: '🚨 Very Poor Air Quality',
        body: message || `ALERT: Very poor air quality (AQI: ${Math.round(value)}). Avoid going outside!`,
        priority: 'high',
        vibrationPattern: [400, 200, 400, 200, 400, 200, 400],
        sound: 'default'
      }
    };
    return airConfigs[severity] || airConfigs.moderate;
  }
  
  // Configurações para alertas de vento
  if (type === 'wind') {
    const windConfigs = {
      strong: {
        title: '💨 Strong Wind',
        body: message || `Strong wind detected (${Math.round(value)} km/h). Use caution outdoors.`,
        priority: 'high',
        vibrationPattern: [300, 150, 300, 150, 300],
        sound: 'default'
      },
      very_strong: {
        title: '🌪️ Very Strong Wind',
        body: message || `ALERT: Very strong wind (${Math.round(value)} km/h). Avoid open areas!`,
        priority: 'high',
        vibrationPattern: [400, 200, 400, 200, 400, 200, 400],
        sound: 'default'
      }
    };
    return windConfigs[severity] || windConfigs.strong;
  }
  
  // Configurações para alertas de UV
  if (type === 'uv_high') {
    return {
      title: '☀️ High UV Index',
      body: message || `High UV index (${Math.round(value)}). Use sunscreen and avoid prolonged sun exposure.`,
      priority: 'normal',
      vibrationPattern: [200, 100, 200],
      sound: 'default'
    };
  }
  
  // Configurações para alertas de temperatura
  if (type === 'temperature') {
    const tempConfigs = {
      high: {
        title: '🌡️ High Temperature',
        body: message || `High temperature (${Math.round(value)}°C). Stay hydrated!`,
        priority: 'normal',
        vibrationPattern: [200, 100, 200],
        sound: 'default'
      },
      low: {
        title: '❄️ Low Temperature',
        body: message || `Low temperature (${Math.round(value)}°C). Dress warmly!`,
        priority: 'normal',
        vibrationPattern: [200, 100, 200],
        sound: 'default'
      }
    };
    return tempConfigs[severity] || tempConfigs.high;
  }
  
  // Configuração padrão para tipos desconhecidos
  return {
    title: '⚠️ Weather Alert',
    body: message || `Alert detected: ${type} (${severity})`,
    priority: 'normal',
    vibrationPattern: [200, 100, 200],
    sound: 'default'
  };
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
    console.log(`🗑️ Removed ${result.rowCount} invalid token(s) from the database`);
  } catch (error) {
    console.error('Error removing invalid tokens:', error);
  }
}

/**
 * Verifica se um usuário está em cooldown para um tipo específico de alerta
 * @param {Object} db - Instância do banco de dados
 * @param {number} userId - ID do usuário
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @param {string} alertType - Tipo do alerta (rain_now, uv_high, etc)
 * @returns {Promise<boolean>} True se está em cooldown, False caso contrário
 */
async function isUserAlertInCooldown(db, userId, latitude, longitude, alertType) {
  try {
    // Arredondar coordenadas para 2 casas decimais (~1.1km)
    const roundedLat = roundCoordinate(latitude);
    const roundedLon = roundCoordinate(longitude);
    
    // Obter cooldown específico para o tipo de alerta
    const cooldownHours = getCooldownHours(alertType);
    
    const query = `
      SELECT last_notification_at
      FROM notification_cooldown
      WHERE user_id = $1 AND latitude = $2 AND longitude = $3 AND alert_type = $4
        AND last_notification_at > NOW() - INTERVAL '${cooldownHours} hours'
    `;
    
    const { rows } = await db.query(query, [userId, roundedLat, roundedLon, alertType]);
    
    if (rows.length > 0) {
      const lastNotification = new Date(rows[0].last_notification_at);
      const minutesAgo = Math.floor((Date.now() - lastNotification.getTime()) / 1000 / 60);
      const hoursAgo = (minutesAgo / 60).toFixed(1);
      console.log(`⏳ User ${userId} in cooldown for ${roundedLat}, ${roundedLon} (${alertType}: last ${hoursAgo}h ago, cooldown: ${cooldownHours}h)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking cooldown:', error);
    return false; // Em caso de erro, permite enviar notificação
  }
}

/**
 * Registra que uma notificação foi enviada para um usuário em uma localização
 * @param {Object} db - Instância do banco de dados
 * @param {number} userId - ID do usuário
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @param {string} alertType - Tipo do alerta (rain_now, air_quality, wind, etc)
 * @param {string} severity - Severidade do alerta (opcional)
 * @param {number} alertValue - Valor do alerta (opcional)
 */
async function recordNotificationSent(db, userId, latitude, longitude, alertType, severity = null, alertValue = null) {
  try {
    // Arredondar coordenadas para 2 casas decimais (~1.1km)
    const roundedLat = roundCoordinate(latitude);
    const roundedLon = roundCoordinate(longitude);
    
    const query = `
      INSERT INTO notification_cooldown (user_id, latitude, longitude, alert_type, severity, alert_value, last_notification_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, latitude, longitude, alert_type)
      DO UPDATE SET
        last_notification_at = NOW(),
        severity = EXCLUDED.severity,
        alert_value = EXCLUDED.alert_value
    `;
    
    await db.query(query, [userId, roundedLat, roundedLon, alertType, severity, alertValue]);
    console.log(`📝 Cooldown recorded for user ${userId} at ${roundedLat}, ${roundedLon} (${alertType}, severity: ${severity}, value: ${alertValue})`);
  } catch (error) {
    console.error('Error recording cooldown:', error);
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
      SELECT DISTINCT d.user_id, d.token
      FROM devices d
      INNER JOIN users u ON d.user_id = u.id
      WHERE u.uid IN (${placeholders})
        AND d.token IS NOT NULL
        AND d.user_id IS NOT NULL
    `;

    const { rows } = await db.query(query, userUids);
    
    return rows.map(row => ({
      userId: row.user_id,
      token: row.token
    }));

  } catch (error) {
    console.error('Error fetching device tokens:', error);
    return [];
  }
}

/**
 * Envia notificação de alerta para dispositivos específicos
 * @param {Array} tokens - Array de tokens de dispositivos
 * @param {Object} alert - Objeto do alerta
 * @param {Object} location - Objeto com latitude e longitude
 * @param {Object} db - Instância do banco de dados
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendAlertNotification(tokens, alert, location, db) {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens available to send notification');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const config = getNotificationConfig(alert);
    
    // Construir mensagem para Firebase Cloud Messaging
    const message = {
      notification: {
        title: config.title,
        body: config.body
      },
      android: {
        priority: config.priority,
        notification: {
          channelId: 'weather_alerts',
          defaultSound: true,
          defaultVibrateTimings: false,
          vibrateTimingsMillis: config.vibrationPattern,
          tag: `${alert.type}_${location.latitude}_${location.longitude}` // Evita notificações duplicadas
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
        type: alert.type,
        severity: alert.severity,
        value: alert.value.toString(),
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        vibrationPattern: JSON.stringify(config.vibrationPattern),
        message: alert.message
      }
    };

    console.log(`📤 Sending ${alert.type} (${alert.severity}) to ${tokens.length} device(s)...`);
    
    const response = await admin.messaging().sendEachForMulticast({
      ...message,
      tokens: tokens
    });

    console.log(`✅ Notifications sent: ${response.successCount} success, ${response.failureCount} failures`);
    
    // Identificar e remover tokens inválidos
    const invalidTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.error(`Error for token ${idx + 1}:`, errorCode, resp.error?.message);
          
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
    console.error('Error sending notification:', error);
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [], error: error.message };
  }
}

/**
 * Processa alertas meteorológicos e envia notificações
 * @param {Object} db - Instância do banco de dados
 * @param {Array} locationAlerts - Array de localizações com alertas
 * @returns {Promise<Object>} Resumo do processamento
 */
async function processWeatherAlerts(db, locationAlerts) {
  if (!locationAlerts || locationAlerts.length === 0) {
    console.log('✅ No alerts to process');
    return { totalNotifications: 0, alertsByType: {}, results: [] };
  }

  console.log(`\n📬 Processing alerts for ${locationAlerts.length} location(s)...`);
  
  const results = [];
  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  const alertsByType = {};

  for (const locationData of locationAlerts) {
    console.log(`\n--- 📍 ${locationData.latitude}, ${locationData.longitude} ---`);
    console.log(`Alerts: ${locationData.alerts.length} | Users: ${locationData.userCount}`);

    // Obter tokens dos usuários
    const userDevices = await getDeviceTokensForUsers(db, locationData.userUids);
    
    if (userDevices.length === 0) {
      console.log('⚠️ No registered devices');
      continue;
    }

    // Processar cada alerta para esta localização
    for (const alert of locationData.alerts) {
      console.log(`\n  🔔 ${alert.type} (${alert.severity})`);
      
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      
      // Filtrar usuários sem cooldown para este tipo de alerta
      const devicesToNotify = [];
      let skipped = 0;

      for (const device of userDevices) {
        const inCooldown = await isUserAlertInCooldown(
          db, device.userId, locationData.latitude, locationData.longitude, alert.type
        );
        
        if (!inCooldown) {
          devicesToNotify.push(device);
        } else {
          skipped++;
        }
      }

      console.log(`  📱 ${devicesToNotify.length} to notify, ${skipped} in cooldown`);

      if (devicesToNotify.length === 0) {
        console.log('  ⏭️ All in cooldown');
        continue;
      }

      // Enviar notificações
      const tokensToSend = devicesToNotify.map(d => d.token);
      const result = await sendAlertNotification(
        tokensToSend,
        alert,
        { latitude: locationData.latitude, longitude: locationData.longitude },
        db
      );

      // Registrar cooldown para envios bem-sucedidos
      if (result.successCount > 0) {
        for (let i = 0; i < devicesToNotify.length; i++) {
          if (result.responses[i]?.success) {
            await recordNotificationSent(
              db,
              devicesToNotify[i].userId,
              locationData.latitude,
              locationData.longitude,
              alert.type,
              alert.severity,
              alert.value
            );
          }
        }
      }

      totalSuccessCount += result.successCount;
      totalFailureCount += result.failureCount;
    }

    results.push({
      location: `${locationData.latitude}, ${locationData.longitude}`,
      alertCount: locationData.alerts.length,
      userCount: locationData.userCount
    });
  }

  console.log('\n=== 📊 RESUMO ===');
  console.log(`Localizações: ${locationAlerts.length}`);
  console.log(`Notificações enviadas: ${totalSuccessCount}`);
  console.log(`Falhas: ${totalFailureCount}`);
  console.log('\nAlertas por tipo:');
  Object.entries(alertsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  return {
    totalNotifications: totalSuccessCount,
    totalFailures: totalFailureCount,
    alertsByType,
    results
  };
}

module.exports = {
  getNotificationConfig,
  getDeviceTokensForUsers,
  removeInvalidTokens,
  isUserAlertInCooldown,
  recordNotificationSent,
  sendAlertNotification,
  processWeatherAlerts
};
