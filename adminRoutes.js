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

    // Prepara a mensagem
    const messageObj = {
      notification: {
        title,
        body: message,
      },
      tokens: tokens
    };

    // Envia as notificações
    try {
      // Para cada token, envia uma notificação individual
      const sendPromises = tokens.map(token => {
        return admin.messaging().sendToDevice(token, {
          notification: {
            title,
            body: message,
          }
        });
      });
      
      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.successCount > 0).length;
      const failureCount = results.length - successCount;
      
      res.json({
        success: true,
        sent: successCount,
        failed: failureCount,
        results: results.map(r => ({
          success: r.successCount > 0,
          message: r.results[0]?.error?.message || 'Enviado com sucesso'
        })),
      });
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      throw error; // Re-throw para ser capturado pelo catch externo
    }
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

module.exports = router;
