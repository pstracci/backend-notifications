const express = require('express');
const router = express.Router();
const db = require('./db');
const admin = require('./firebase-config');

// Configurações de notificação por intensidade (mesmas do notificationService)
const notificationConfigs = {
  light: {
    priority: 'normal',
    vibrationPattern: [200, 100, 200]
  },
  moderate: {
    priority: 'high',
    vibrationPattern: [300, 150, 300, 150, 300]
  },
  heavy: {
    priority: 'high',
    vibrationPattern: [400, 200, 400, 200, 400, 200, 400]
  },
  extreme: {
    priority: 'high',
    vibrationPattern: [500, 250, 500, 250, 500, 250, 500, 250, 500]
  }
};

// Listar todos os usuários
router.get('/api/admin/users', async (req, res) => {
  try {
    const { rows: users } = await db.query('SELECT id, uid, email, created_at FROM users');
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Enviar notificação de teste para um usuário específico
router.post('/api/admin/send-notification', async (req, res) => {
  const { userId, title, message, intensity = 'moderate', precipitation = 5.0 } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ error: 'userId, title e message são obrigatórios' });
  }

  try {
    console.log('\n=== ENVIANDO NOTIFICAÇÃO DE TESTE ===');
    console.log(`Usuário ID: ${userId}`);
    console.log(`Intensidade: ${intensity}`);
    console.log(`Título: ${title}`);
    console.log(`Mensagem: ${message}`);

    // Busca todos os tokens de dispositivos disponíveis
    const { rows: userDevices } = await db.query(
      `SELECT token FROM devices WHERE token IS NOT NULL`
    );

    if (userDevices.length === 0) {
      return res.status(404).json({ error: 'Nenhum dispositivo com token encontrado' });
    }

    const tokens = userDevices.map(device => device.token);
    console.log(`📱 Enviando para ${tokens.length} dispositivo(s)`);

    // Obtém configuração de intensidade
    const config = notificationConfigs[intensity] || notificationConfigs.moderate;

    // Cria mensagens para cada token
    const messages = tokens.map(token => ({
      token: token,
      notification: {
        title: title,
        body: message
      },
      data: {
        type: 'rain_alert',
        intensity: intensity,
        precipitation: precipitation.toString(),
        timestamp: new Date().toISOString(),
        source: 'admin_test'
      },
      android: {
        priority: config.priority,
        notification: {
          channelId: 'rain_alerts',
          defaultSound: true,
          defaultVibrateTimings: false,
          vibrateTimingsMillis: config.vibrationPattern,
          tag: `admin_test_${Date.now()}`
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    }));

    // Envia cada mensagem individualmente
    const sendPromises = messages.map(async (message, index) => {
      try {
        const response = await admin.messaging().send(message);
        console.log(`✅ Mensagem ${index + 1}/${messages.length} enviada com sucesso`);
        return { success: true, messageId: response };
      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem ${index + 1}:`, error.message);
        return {
          success: false,
          error: error.message || 'Erro desconhecido',
          code: error.code
        };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`\n📊 Resultado: ${successCount} sucesso, ${failureCount} falhas`);
    console.log('=====================================\n');
    
    res.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: tokens.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

module.exports = router;
