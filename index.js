// index.js

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const admin = require('./firebase-config');
const db = require('./db');
const authMiddleware = require('./authMiddleware');
const updateBackgroundLocation = require('./backgroundLocation');
const adminRoutes = require('./adminRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas de administração
app.use(adminRoutes);

// --- ROTAS DA API ---

// Rota para autenticação
app.post('/api/auth/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).send({ error: 'Token de autenticação não fornecido.' });
  }

  try {
    // 1. Verifica se o token recebido é válido usando o Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log(`Token verificado com sucesso para o UID: ${uid}`);

    // 2. Verifica se o usuário já existe no nosso banco de dados
    const findUserQuery = 'SELECT * FROM users WHERE uid = $1';
    const { rows } = await db.query(findUserQuery, [uid]);

    let user;

    if (rows.length === 0) {
      // 3. Se o usuário NÃO existe, cria um novo registro
      console.log(`Usuário com UID ${uid} não encontrado. Criando novo registro.`);
      const insertUserQuery = 'INSERT INTO users (uid) VALUES ($1) RETURNING *';
      const newUserResult = await db.query(insertUserQuery, [uid]);
      user = newUserResult.rows[0];
    } else {
      // 4. Se o usuário JÁ existe, apenas o seleciona
      console.log(`Usuário com UID ${uid} já existe no banco de dados.`);
      user = rows[0];
    }
    
    // 5. Retorna uma resposta de sucesso com os dados do usuário do nosso banco
    res.status(200).send({ success: true, user: user });

  } catch (error) {
    console.error('Erro ao verificar token ou ao processar usuário:', error);
    // O token pode ser inválido ou expirado
    res.status(403).send({ error: 'Falha na autenticação. Token inválido.' });
  }
});

// Rota para atualização de localização em background
app.post('/api/background/location', authMiddleware, updateBackgroundLocation);

// Rota para atualização manual de localização (mantida para compatibilidade)
app.put('/api/users/location', authMiddleware, async (req, res) => {
  const { uid } = req.user;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).send({ error: 'Latitude e Longitude são obrigatórias.' });
  }

  try {
    console.log(`Atualizando localização para o UID ${uid}: Lat ${latitude}, Lon ${longitude}`);

    const updateUserLocationQuery = `
      UPDATE users 
      SET 
        latitude = $1, 
        longitude = $2, 
        location_updated_at = NOW() 
      WHERE uid = $3 
      RETURNING id, uid, latitude, longitude, location_updated_at;
    `;

    const { rows } = await db.query(updateUserLocationQuery, [latitude, longitude, uid]);

    if (rows.length === 0) {
      return res.status(404).send({ error: 'Usuário não encontrado no banco de dados.' });
    }

    res.status(200).send({ success: true, user: rows[0] });

  } catch (error) {
    console.error(`Erro ao atualizar localização para o UID ${uid}:`, error);
    res.status(500).send({ error: 'Falha ao atualizar a localização.' });
  }
});

// Endpoint para registro de dispositivos
app.post('/register-device', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).send({ error: 'Token não fornecido.' });
  }

  try {
    const queryText = 'INSERT INTO devices (token) VALUES ($1) ON CONFLICT (token) DO NOTHING';
    await db.query(queryText, [token]);
    console.log(`Token registrado ou já existente: ${token.substring(0, 20)}...`);
    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Erro ao registrar token:', error);
    res.status(500).send({ error: 'Falha ao registrar dispositivo.' });
  }
});

// Endpoint para enviar notificação de teste
app.post('/api/test-notification', async (req, res) => {
  try {
    console.log('=== INICIANDO TESTE DE NOTIFICAÇÃO ===');
    
    const { rows } = await db.query('SELECT token FROM devices WHERE token IS NOT NULL');
    const tokens = rows.map(row => row.token);
    
    console.log(`Total de tokens encontrados: ${tokens.length}`);
    
    if (tokens.length === 0) {
      return res.status(404).send({ 
        error: 'Nenhum dispositivo registrado.',
        tokens_count: 0
      });
    }

    // Log dos primeiros caracteres de cada token
    tokens.forEach((token, index) => {
      console.log(`Token ${index + 1}: ${token.substring(0, 30)}...`);
    });

    const message = {
      notification: {
        title: '🧪 Notificação de Teste',
        body: 'Esta é uma notificação de teste do backend!'
      },
      tokens: tokens,
    };

    console.log('Enviando notificação via Firebase...');
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`✅ Sucesso: ${response.successCount} notificações enviadas`);
    console.log(`❌ Falhas: ${response.failureCount}`);
    
    // Log detalhado de falhas
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Erro no token ${idx + 1}:`, resp.error?.code, resp.error?.message);
        }
      });
    }

    res.status(200).send({ 
      success: true,
      total_tokens: tokens.length,
      success_count: response.successCount,
      failure_count: response.failureCount,
      details: response.responses.map((resp, idx) => ({
        token_preview: tokens[idx].substring(0, 20) + '...',
        success: resp.success,
        error: resp.error ? {
          code: resp.error.code,
          message: resp.error.message
        } : null
      }))
    });

  } catch (error) {
    console.error('❌ ERRO ao enviar notificação de teste:', error);
    res.status(500).send({ 
      error: 'Falha ao enviar notificação de teste.',
      details: error.message
    });
  }
});

// --- LÓGICA DO AGENDADOR (CRON JOB) ---
cron.schedule('*/15 * * * *', async () => {
  console.log('Executando verificação de chuva agendada...');
  const vaiChover = await verificaClima(); 
  if (vaiChover) {
    console.log('Condição de chuva detectada! Buscando tokens para notificar...');
    try {
      const { rows } = await db.query('SELECT token FROM devices WHERE token IS NOT NULL');
      const tokens = rows.map(row => row.token);
      if (tokens.length > 0) {
        console.log(`Enviando notificações para ${tokens.length} dispositivo(s)`);
        const message = {
          notification: {
            title: 'Alerta de Chuva! ☔️',
            body: 'Chuva se aproximando da sua região. Prepare-se!'
          },
          tokens: tokens,
        };
        const response = await admin.messaging().sendMulticast(message);
        console.log(`✅ Notificações enviadas com sucesso: ${response.successCount}`);
        if (response.failureCount > 0) {
          console.log(`❌ Falhas ao enviar: ${response.failureCount}`);
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.error(`Erro no token ${idx + 1}:`, resp.error?.code, resp.error?.message);
            }
          });
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

async function verificaClima() {
  console.log('Na função verificaClima, retornando "true" para fins de teste.');
  return true;
}

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Conexão com o banco de dados PostgreSQL bem-sucedida!');
    console.log('Horário atual retornado pelo banco:', result.rows[0].now);
  } catch (err) {
    console.error('❌ ERRO AO CONECTAR COM O BANCO DE DADOS NA INICIALIZAÇÃO:', err.stack);
  }
});
