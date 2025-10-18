// index.js

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const admin = require('./firebase-config');
const db = require('./db');
const authMiddleware = require('./authMiddleware');
const updateBackgroundLocation = require('./backgroundLocation');
const adminRoutes = require('./adminRoutes');
const weatherService = require('./weatherService');
const notificationService = require('./notificationService');

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

// Endpoint para registro de dispositivos (com criação automática de usuário)
app.post('/register-device', async (req, res) => {
  const { token, uid, email, name, latitude, longitude } = req.body;
  
  if (!token) {
    return res.status(400).send({ error: 'Token não fornecido.' });
  }
  
  if (!uid) {
    return res.status(400).send({ error: 'UID do usuário não fornecido.' });
  }

  try {
    console.log(`\n=== REGISTRO DE DISPOSITIVO ===`);
    console.log(`UID: ${uid}`);
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log(`Email: ${email || 'não fornecido'}`);
    console.log(`Nome: ${name || 'não fornecido'}`);
    console.log(`Localização: ${latitude}, ${longitude}`);
    
    // 1. Buscar ou criar o usuário
    let userQuery = 'SELECT id FROM users WHERE uid = $1';
    let { rows: userRows } = await db.query(userQuery, [uid]);
    
    let userId;
    
    if (userRows.length === 0) {
      // Usuário não existe, criar novo
      console.log(`📝 Criando novo usuário: ${uid}`);
      
      const insertUserQuery = `
        INSERT INTO users (uid, email, name, latitude, longitude, location_updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;
      
      const { rows: newUserRows } = await db.query(insertUserQuery, [
        uid,
        email || null,
        name || null,
        latitude || null,
        longitude || null
      ]);
      
      userId = newUserRows[0].id;
      console.log(`✅ Usuário criado com ID: ${userId}`);
    } else {
      // Usuário existe, atualizar informações se fornecidas
      userId = userRows[0].id;
      console.log(`✅ Usuário encontrado com ID: ${userId}`);
      
      // Atualizar email, nome e localização se fornecidos
      if (email || name || latitude !== undefined) {
        const updateQuery = `
          UPDATE users 
          SET 
            email = COALESCE($1, email),
            name = COALESCE($2, name),
            latitude = COALESCE($3, latitude),
            longitude = COALESCE($4, longitude),
            location_updated_at = CASE 
              WHEN $3 IS NOT NULL THEN NOW() 
              ELSE location_updated_at 
            END
          WHERE id = $5
        `;
        
        await db.query(updateQuery, [
          email || null,
          name || null,
          latitude || null,
          longitude || null,
          userId
        ]);
        
        console.log(`📝 Informações do usuário atualizadas`);
      }
    }
    
    // 2. Registrar ou atualizar o dispositivo
    const deviceQuery = `
      INSERT INTO devices (token, user_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id, token) 
      DO UPDATE SET user_id = $2
      RETURNING id
    `;
    
    const { rows: deviceRows } = await db.query(deviceQuery, [token, userId]);
    console.log(`✅ Dispositivo registrado com ID: ${deviceRows[0].id}`);
    console.log(`=====================================\n`);
    
    res.status(200).send({ 
      success: true,
      userId: userId,
      deviceId: deviceRows[0].id
    });
  } catch (error) {
    console.error('❌ Erro ao registrar dispositivo:', error);
    res.status(500).send({ error: 'Falha ao registrar dispositivo: ' + error.message });
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
      }
    };

    console.log('Enviando notificação via Firebase...');
    const response = await admin.messaging().sendEachForMulticast({
      ...message,
      tokens: tokens
    });
    
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
// Executa a cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  console.log('\n========================================');
  console.log('🔍 Executando verificação de chuva agendada...');
  console.log(`Horário: ${new Date().toLocaleString('pt-BR')}`);
  console.log('========================================\n');
  
  try {
    // 1. Verificar previsão de chuva para todas as localizações únicas
    const forecasts = await weatherService.checkRainForAllLocations(db);
    
    if (forecasts.length === 0) {
      console.log('✅ Sem previsão de chuva significativa para nenhuma localização.');
      return;
    }
    
    console.log(`\n⚠️ Chuva detectada em ${forecasts.length} localização(ões)!\n`);
    
    // 2. Processar previsões e enviar notificações
    const summary = await notificationService.processRainForecasts(db, forecasts);
    
    console.log('\n========================================');
    console.log('✅ Verificação concluída!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERRO durante verificação de chuva:', error);
    console.error('Stack trace:', error.stack);
  }
});

// Endpoint manual para testar verificação de chuva
app.post('/api/check-rain-now', async (req, res) => {
  console.log('\n=== VERIFICAÇÃO MANUAL DE CHUVA INICIADA ===\n');
  
  try {
    const forecasts = await weatherService.checkRainForAllLocations(db);
    
    if (forecasts.length === 0) {
      return res.status(200).send({
        success: true,
        message: 'Sem previsão de chuva significativa',
        forecasts: []
      });
    }
    
    const summary = await notificationService.processRainForecasts(db, forecasts);
    
    res.status(200).send({
      success: true,
      message: 'Verificação concluída',
      summary: summary
    });
    
  } catch (error) {
    console.error('Erro na verificação manual:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para verificar status do rate limiter
app.get('/api/rate-limit-status', (req, res) => {
  try {
    const stats = weatherService.getRateLimiterStats();
    
    res.status(200).send({
      success: true,
      limits: {
        perSecond: { max: 3, description: '3 requisições por segundo' },
        perHour: { max: 25, description: '25 requisições por hora' },
        perDay: { max: 500, description: '500 requisições por dia' }
      },
      current: stats,
      warnings: [
        stats.perDay.percentage >= 90 ? '⚠️ Limite diário quase atingido!' : null,
        stats.perHour.percentage >= 90 ? '⚠️ Limite por hora quase atingido!' : null,
        stats.perSecond.percentage >= 90 ? '⚠️ Limite por segundo quase atingido!' : null
      ].filter(w => w !== null)
    });
    
  } catch (error) {
    console.error('Erro ao obter status do rate limiter:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para diagnosticar usuário
app.get('/api/diagnose-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    console.log(`\n=== DIAGNÓSTICO DO USUÁRIO ${uid} ===\n`);
    
    // 1. Verificar usuário
    const userQuery = 'SELECT * FROM users WHERE uid = $1';
    const { rows: users } = await db.query(userQuery, [uid]);
    
    if (users.length === 0) {
      return res.status(404).send({
        success: false,
        error: 'Usuário não encontrado no banco de dados',
        uid: uid
      });
    }
    
    const user = users[0];
    
    // 2. Verificar dispositivos
    const devicesQuery = 'SELECT * FROM devices WHERE user_id = $1';
    const { rows: devices } = await db.query(devicesQuery, [user.id]);
    
    // 3. Verificar cooldown
    const cooldownQuery = `
      SELECT * FROM notification_cooldown 
      WHERE user_id = $1
      ORDER BY last_notification_at DESC
    `;
    const { rows: cooldowns } = await db.query(cooldownQuery, [user.id]);
    
    // 4. Verificar localizações próximas
    const nearbyQuery = `
      SELECT DISTINCT latitude, longitude, COUNT(*) as user_count
      FROM users
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND ABS(latitude - $1) < 0.1
        AND ABS(longitude - $2) < 0.1
      GROUP BY latitude, longitude
      ORDER BY user_count DESC
    `;
    const { rows: nearby } = await db.query(nearbyQuery, [user.latitude, user.longitude]);
    
    // 5. Analisar problemas
    const problems = [];
    const warnings = [];
    
    if (!user.latitude || !user.longitude) {
      problems.push('Localização do usuário não está definida');
    }
    
    if (devices.length === 0) {
      problems.push('Nenhum dispositivo registrado');
    } else {
      devices.forEach((device, index) => {
        if (!device.token) {
          problems.push(`Dispositivo ${index + 1} não tem token FCM`);
        }
      });
    }
    
    const activeCooldowns = cooldowns.filter(cd => {
      const minutesAgo = Math.floor((Date.now() - new Date(cd.last_notification_at).getTime()) / 1000 / 60);
      return minutesAgo < 60;
    });
    
    if (activeCooldowns.length > 0) {
      warnings.push(`${activeCooldowns.length} cooldown(s) ativo(s) - usuário não receberá notificações para essas localizações por até 1 hora`);
    }
    
    // 6. Preparar resposta
    res.status(200).send({
      success: true,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        location: {
          latitude: user.latitude,
          longitude: user.longitude,
          updated_at: user.location_updated_at
        },
        created_at: user.created_at
      },
      devices: devices.map(d => ({
        id: d.id,
        token_preview: d.token ? d.token.substring(0, 50) + '...' : null,
        has_token: !!d.token,
        created_at: d.created_at
      })),
      cooldowns: cooldowns.map(cd => {
        const minutesAgo = Math.floor((Date.now() - new Date(cd.last_notification_at).getTime()) / 1000 / 60);
        return {
          location: { latitude: cd.latitude, longitude: cd.longitude },
          intensity: cd.intensity_level,
          precipitation: cd.precipitation,
          last_notification_at: cd.last_notification_at,
          minutes_ago: minutesAgo,
          is_active: minutesAgo < 60
        };
      }),
      nearby_locations: nearby.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        user_count: loc.user_count
      })),
      diagnosis: {
        problems: problems,
        warnings: warnings,
        status: problems.length === 0 ? 'ok' : 'has_problems'
      }
    });
    
  } catch (error) {
    console.error('Erro ao diagnosticar usuário:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

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
