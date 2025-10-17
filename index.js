// index.js

const express = require('express');
const cron = require('node-cron');
const admin = require('./firebase-config'); // Importa a config do Firebase
const db = require('./db'); // Importa nosso novo módulo de banco de dados

const app = express();
app.use(express.json()); // Middleware para ler o corpo de requisições JSON

// --- ENDPOINTS DA API ---

// Endpoint para o app Flutter/iOS/Android registrar o token de notificação
app.post('/register-device', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).send({ error: 'Token não fornecido.' });
  }

  try {
    // Usa nosso módulo 'db' para inserir o token no banco, evitando duplicatas
    const queryText = 'INSERT INTO devices (token) VALUES ($1) ON CONFLICT (token) DO NOTHING';
    await db.query(queryText, [token]);

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
  console.log('Executando verificação de chuva agendada...');

  // 1. Chame suas APIs de clima aqui
  const vaiChover = await verificaClima(); // Função que você implementa

  if (vaiChover) {
    console.log('Condição de chuva detectada! Buscando tokens para notificar...');
    try {
      const { rows } = await db.query('SELECT token FROM devices');
      const tokens = rows.map(row => row.token);

      if (tokens.length > 0) {
        console.log(`Enviando notificações para ${tokens.length} dispositivo(s).`);
        const message = {
          notification: {
            title: 'Alerta de Chuva! ☔️',
            body: 'Chuva se aproximando da sua região. Prepare-se!'
          },
          tokens: tokens, // Envia para múltiplos dispositivos de uma vez
        };

        const response = await admin.messaging().sendMulticast(message);
        console.log(`Notificações enviadas com sucesso: ${response.successCount}`);
        
        if (response.failureCount > 0) {
            console.log(`Falhas ao enviar: ${response.failureCount}`);
            // Aqui você poderia adicionar uma lógica para remover tokens inválidos do banco de dados
        }
      } else {
          console.log('Nenhum dispositivo registrado para receber notificações.');
      }
    } catch (error) {
      console.error('Erro ao buscar tokens ou enviar notificações:', error);
    }
  } else {
    console.log('Sem previsão de chuva no momento.');
  }
});

// Função placeholder para a lógica de verificação do clima
async function verificaClima() {
    //
    // SUA LÓGICA PARA CHAMAR AS APIS DE CLIMA (EX: OPENWEATHERMAP) VAI AQUI
    // E DEVE USAR A LOCALIZAÇÃO DOS USUÁRIOS
    //
    // Por enquanto, vamos retornar 'true' para forçar o envio da notificação nos testes.
    console.log('Na função verificaClima, retornando "true" para fins de teste.');
    return true;
}

// --- INICIALIZAÇÃO DO SERVIDOR ---

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  
  // Teste de conexão com o banco de dados na inicialização
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Conexão com o banco de dados PostgreSQL bem-sucedida!');
    console.log('Horário atual retornado pelo banco:', result.rows[0].now);
  } catch (err) {
    console.error('❌ ERRO AO CONECTAR COM O BANCO DE DADOS NA INICIALIZAÇÃO:', err.stack);
  }
});