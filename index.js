const express = require('express');
const cron = require('node-cron');
const admin = require('./firebase-config'); // Importa a config do Firebase

const app = express();
app.use(express.json()); // Para conseguir ler o corpo das requisições

// --- LÓGICA DO BANCO DE DADOS (Exemplo com PostgreSQL) ---
// O Railway injetará a URL de conexão na variável de ambiente DATABASE_URL
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Endpoint para o app Flutter/iOS/Android registrar o token
app.post('/register-device', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).send({ error: 'Token não fornecido.' });
  }

  try {
    // Insere o token no banco de dados, evitando duplicatas
    await pool.query('INSERT INTO devices (token) VALUES ($1) ON CONFLICT (token) DO NOTHING', [token]);
    console.log(`Token registrado ou já existente: ${token.substring(0, 20)}...`);
    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Erro ao registrar token:', error);
    res.status(500).send({ error: 'Falha ao registrar dispositivo.' });
  }
});

// --- LÓGICA DO AGENDADOR (CRON JOB) ---
// Roda a cada 15 minutos: '*/15 * * * *'
cron.schedule('*/15 * * * *', async () => {
  console.log('Executando verificação de chuva...');

  // 1. Chame suas APIs de clima aqui
  const vaiChover = await verificaClima(); // Função que você implementa

  if (vaiChover) {
    console.log('Condição de chuva detectada! Enviando notificações...');
    try {
      const { rows } = await pool.query('SELECT token FROM devices');
      const tokens = rows.map(row => row.token);

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: 'Alerta de Chuva! ☔️',
            body: 'Chuva se aproximando. Prepare-se!'
          },
          tokens: tokens, // Envia para múltiplos dispositivos de uma vez
        };

        const response = await admin.messaging().sendMulticast(message);
        console.log(`Notificações enviadas com sucesso: ${response.successCount}`);
        if (response.failureCount > 0) {
            console.log(`Falhas ao enviar: ${response.failureCount}`);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar notificações:', error);
    }
  } else {
    console.log('Sem previsão de chuva no momento.');
  }
});

async function verificaClima() {
    //
    // SUA LÓGICA PARA CHAMAR AS APIS DE CLIMA VAI AQUI
    // Retorne `true` se for chover, `false` caso contrário.
    //
    return true; // Apenas para teste
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});