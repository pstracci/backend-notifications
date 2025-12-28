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

// Listar todos os usuários com informações de dispositivos
router.get('/api/admin/users', async (req, res) => {
  try {
    const { rows: users } = await db.query(`
      SELECT 
        u.id, 
        u.uid, 
        u.email,
        u.name,
        u.latitude,
        u.longitude,
        u.created_at,
        u.location_updated_at,
        COUNT(d.id) as device_count
      FROM users u
      LEFT JOIN devices d ON d.user_id = u.id
      GROUP BY u.id, u.uid, u.email, u.name, u.latitude, u.longitude, u.created_at, u.location_updated_at
      ORDER BY u.created_at DESC
    `);
    
    console.log(`📋 Listing ${users.length} user(s)`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Obter detalhes de um usuário específico
router.get('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Buscar informações do usuário
    const { rows: users } = await db.query(
      'SELECT id, uid, email, name, latitude, longitude, created_at, location_updated_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Buscar dispositivos do usuário
    const { rows: devices } = await db.query(
      'SELECT id, token, created_at FROM devices WHERE user_id = $1',
      [userId]
    );
    
    // Buscar histórico de notificações
    const { rows: notifications } = await db.query(
      `SELECT latitude, longitude, intensity_level, precipitation, last_notification_at 
       FROM notification_cooldown 
       WHERE user_id = $1 
       ORDER BY last_notification_at DESC 
       LIMIT 10`,
      [userId]
    );
    
    res.json({
      user: users[0],
      devices: devices,
      notifications: notifications
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Enviar notificação de teste para um usuário específico
router.post('/api/admin/send-notification', async (req, res) => {
  const { userId, title, message, intensity = 'moderate', precipitation = 5.0 } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ error: 'userId, title, and message are required' });
  }

  try {
    console.log('\n=== SENDING TEST NOTIFICATION ===');
    console.log(`User ID: ${userId}`);
    console.log(`Intensity: ${intensity}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);

    // Busca os tokens de dispositivos do usuário específico
    const { rows: userDevices } = await db.query(
      `SELECT d.token 
       FROM devices d 
       WHERE d.user_id = $1 
         AND d.token IS NOT NULL`,
      [userId]
    );

    if (userDevices.length === 0) {
      return res.status(404).json({ error: 'No devices found for this user' });
    }

    const tokens = userDevices.map(device => device.token);
    console.log(`📱 Sending to ${tokens.length} device(s) for user ${userId}`);

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
        console.log(`✅ Message ${index + 1}/${messages.length} sent successfully`);
        return { success: true, messageId: response };
      } catch (error) {
        console.error(`❌ Error sending message ${index + 1}:`, error.message);
        return {
          success: false,
          error: error.message || 'Unknown error',
          code: error.code
        };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`\n📊 Result: ${successCount} success, ${failureCount} failures`);
    console.log('=====================================\n');
    
    res.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: tokens.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
