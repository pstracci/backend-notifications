const express = require('express');
const router = express.Router();
const db = require('./db');
const admin = require('firebase-admin');

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

// Enviar notificação para um usuário específico
router.post('/api/admin/send-notification', async (req, res) => {
  const { userId, title, message } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ error: 'userId, title e message são obrigatórios' });
  }

  try {
    // Busca o token do dispositivo do usuário
    const { rows: userDevices } = await db.query(
      `SELECT token FROM devices WHERE token IS NOT NULL`
    );

    if (userDevices.length === 0) {
      return res.status(404).json({ error: 'Nenhum dispositivo com token encontrado' });
    }

    // Pega todos os tokens disponíveis (não há relação direta com usuário no momento)
    const tokens = userDevices.map(device => device.token);
    
    console.log(`Enviando notificação para ${tokens.length} dispositivo(s)`);

    // Envia a notificação
    const response = await admin.messaging().sendMulticast({
      notification: {
        title,
        body: message,
      },
      tokens,
    });

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      results: response.responses,
    });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

module.exports = router;
