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
    return res.status(401).send({ error: 'Authentication token not provided.' });
  }

  try {
    // 1. Verifica se o token recebido é válido usando o Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    console.log(`Token successfully verified for UID: ${uid}`);

    // 2. Verifica se o usuário já existe no nosso banco de dados
    const findUserQuery = 'SELECT * FROM users WHERE uid = $1';
    const { rows } = await db.query(findUserQuery, [uid]);

    let user;

    if (rows.length === 0) {
      // 3. Se o usuário NÃO existe, cria um novo registro
      console.log(`User with UID ${uid} not found. Creating a new record.`);
      const insertUserQuery = 'INSERT INTO users (uid) VALUES ($1) RETURNING *';
      const newUserResult = await db.query(insertUserQuery, [uid]);
      user = newUserResult.rows[0];
    } else {
      // 4. Se o usuário JÁ existe, apenas o seleciona
      console.log(`User with UID ${uid} already exists in the database.`);
      user = rows[0];
    }
    
    // 5. Retorna uma resposta de sucesso com os dados do usuário do nosso banco
    res.status(200).send({ success: true, user: user });

  } catch (error) {
    console.error('Error verifying token or processing user:', error);
    // O token pode ser inválido ou expirado
    res.status(403).send({ error: 'Authentication failed. Invalid token.' });
  }
});

// Rota para atualização de localização em background
app.post('/api/background/location', authMiddleware, updateBackgroundLocation);

// Rota para atualização manual de localização (mantida para compatibilidade)
app.put('/api/users/location', authMiddleware, async (req, res) => {
  const { uid } = req.user;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).send({ error: 'Latitude and longitude are required.' });
  }

  try {
    console.log(`Updating location for UID ${uid}: Lat ${latitude}, Lon ${longitude}`);

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
      return res.status(404).send({ error: 'User not found in the database.' });
    }

    res.status(200).send({ success: true, user: rows[0] });

  } catch (error) {
    console.error(`Error updating location for UID ${uid}:`, error);
    res.status(500).send({ error: 'Failed to update location.' });
  }
});

// Endpoint para registro de dispositivos (com criação automática de usuário)
app.post('/register-device', async (req, res) => {
  const { token, uid, email, name, latitude, longitude } = req.body;
  
  if (!token) {
    return res.status(400).send({ error: 'Token not provided.' });
  }
  
  if (!uid) {
    return res.status(400).send({ error: 'User UID not provided.' });
  }

  try {
    console.log(`\n=== DEVICE REGISTRATION ===`);
    console.log(`UID: ${uid}`);
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log(`Email: ${email || 'not provided'}`);
    console.log(`Name: ${name || 'not provided'}`);
    console.log(`Location: ${latitude}, ${longitude}`);
    
    // 1. Buscar ou criar o usuário
    let userQuery = 'SELECT id FROM users WHERE uid = $1';
    let { rows: userRows } = await db.query(userQuery, [uid]);
    
    let userId;
    
    if (userRows.length === 0) {
      // Usuário não existe, criar novo
      console.log(`📝 Creating a new user: ${uid}`);
      
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
      console.log(`✅ User created with ID: ${userId}`);
    } else {
      // Usuário existe, atualizar informações se fornecidas
      userId = userRows[0].id;
      console.log(`✅ User found with ID: ${userId}`);
      
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
        
        console.log('📝 User information updated');
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
    console.log(`✅ Device registered with ID: ${deviceRows[0].id}`);
    console.log(`=====================================\n`);
    
    res.status(200).send({ 
      success: true,
      userId: userId,
      deviceId: deviceRows[0].id
    });
  } catch (error) {
    console.error('❌ Error registering device:', error);
    res.status(500).send({ error: 'Failed to register device: ' + error.message });
  }
});

// Endpoint para enviar notificação de teste
app.post('/api/test-notification', async (req, res) => {
  try {
    console.log('=== STARTING NOTIFICATION TEST ===');
    
    const { rows } = await db.query('SELECT token FROM devices WHERE token IS NOT NULL');
    const tokens = rows.map(row => row.token);
    
    console.log(`Total tokens found: ${tokens.length}`);
    
    if (tokens.length === 0) {
      return res.status(404).send({ 
        error: 'No registered devices.',
        tokens_count: 0
      });
    }

    // Log the first characters of each token
    tokens.forEach((token, index) => {
      console.log(`Token ${index + 1}: ${token.substring(0, 30)}...`);
    });

    const message = {
      notification: {
        title: '🧪 Test Notification',
        body: 'This is a test notification from the backend!'
      }
    };

    console.log('Sending notification via Firebase...');
    const response = await admin.messaging().sendEachForMulticast({
      ...message,
      tokens: tokens
    });
    
    console.log(`✅ Success: ${response.successCount} notifications sent`);
    console.log(`❌ Failures: ${response.failureCount}`);
    
    // Log detalhado de falhas
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Error for token ${idx + 1}:`, resp.error?.code, resp.error?.message);
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
    console.error('❌ ERROR sending test notification:', error);
    res.status(500).send({ 
      error: 'Failed to send test notification.',
      details: error.message
    });
  }
});

// --- LÓGICA DO AGENDADOR (CRON JOBS) ---

// CRON 1: Weather alert check (rain)
// Runs every 15 minutes (0, 15, 30, 45) - rain alerts
cron.schedule('0,15,30,45 * * * *', async () => {
  console.log('\n========================================')
  console.log('🌧️ Running RAIN alert check...');
  console.log(`Time: ${new Date().toLocaleString('en-US')}`);
  console.log('========================================\n');
  
  try {
    // 1. Check weather alerts for all locations
    const locationAlerts = await weatherService.checkAlertsForAllLocations(db);
    
    if (locationAlerts.length === 0) {
      console.log('✅ No weather alerts at the moment.');
      return;
    }
    
    console.log(`\n⚠️ Alerts detected in ${locationAlerts.length} location(s)!\n`);
    
    // 2. Process alerts and send notifications
    const summary = await notificationService.processWeatherAlerts(db, locationAlerts);
    
    console.log('\n========================================')
    console.log('✅ Check completed!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR during check:', error);
    console.error('Stack trace:', error.stack);
  }
});

// CRON 2: Weather alert check (UV, air, wind)
// Runs hourly at minute 0 (0:00, 1:00, 2:00, etc)
cron.schedule('0 * * * *', async () => {
  console.log('\n========================================')
  console.log('🌡️ Running UV/AIR/WIND alert check...');
  console.log(`Time: ${new Date().toLocaleString('en-US')}`);
  console.log('========================================\n');
  
  try {
    // 1. Check weather alerts for all locations
    const locationAlerts = await weatherService.checkAlertsForAllLocations(db);
    
    if (locationAlerts.length === 0) {
      console.log('✅ No weather alerts at the moment.');
      return;
    }
    
    console.log(`\n⚠️ Alerts detected in ${locationAlerts.length} location(s)!\n`);
    
    // 2. Process alerts and send notifications
    const summary = await notificationService.processWeatherAlerts(db, locationAlerts);
    
    console.log('\n========================================')
    console.log('✅ Check completed!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR during check:', error);
    console.error('Stack trace:', error.stack);
  }
});

// CRON 3: Cleanup expired cooldown records
// Runs hourly at minute 5 (5, 1:05, 2:05, etc)
cron.schedule('5 * * * *', async () => {
  console.log('\n========================================')
  console.log('🧹 Running expired cooldown cleanup...');
  console.log(`Time: ${new Date().toLocaleString('en-US')}`);
  console.log('========================================\n');
  
  try {
    // Remove rain records older than 2 hours
    const rainResult = await db.query(`
      DELETE FROM notification_cooldown
      WHERE alert_type IN ('rain_now', 'rain_forecast')
        AND last_notification_at < NOW() - INTERVAL '2 hours'
    `);
    
    // Remove UV/air/wind records older than 8 hours
    const otherResult = await db.query(`
      DELETE FROM notification_cooldown
      WHERE alert_type IN ('uv_high', 'air_quality', 'wind', 'wind_forecast')
        AND last_notification_at < NOW() - INTERVAL '8 hours'
    `);
    
    const totalRemoved = rainResult.rowCount + otherResult.rowCount;
    
    if (totalRemoved > 0) {
      console.log(`✅ ${rainResult.rowCount} rain record(s) removed (>2h)`);
      console.log(`✅ ${otherResult.rowCount} UV/air/wind record(s) removed (>8h)`);
      console.log(`📊 Total removed: ${totalRemoved}`);
    } else {
      console.log('✅ No expired records to remove');
    }
    
    // Table stats
    const stats = await db.query('SELECT COUNT(*) as total FROM notification_cooldown');
    console.log(`📊 Total active records: ${stats.rows[0].total}`);
    
    console.log('\n========================================')
    console.log('✅ Cleanup completed!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR during cleanup:', error);
    console.error('Stack trace:', error.stack);
  }
});

// Manual endpoint to test cooldown cleanup
app.post('/api/cleanup-cooldown-now', async (req, res) => {
  console.log('\n=== MANUAL COOLDOWN CLEANUP STARTED ===\n');
  
  try {
    // Remove records older than 1 hour
    const result = await db.query(`
      DELETE FROM notification_cooldown
      WHERE last_notification_at < NOW() - INTERVAL '1 hour'
    `);
    
    // Estatísticas da tabela
    const stats = await db.query('SELECT COUNT(*) as total FROM notification_cooldown');
    
    res.status(200).send({
      success: true,
      message: 'Cleanup completed',
      removed: result.rowCount,
      remaining: parseInt(stats.rows[0].total)
    });
    
  } catch (error) {
    console.error('Error during manual cleanup:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Manual endpoint to test alert check
app.post('/api/check-alerts-now', async (req, res) => {
  console.log('\n=== MANUAL ALERT CHECK STARTED ===\n');
  
  try {
    const locationAlerts = await weatherService.checkAlertsForAllLocations(db);
    
    if (locationAlerts.length === 0) {
      return res.status(200).send({
        success: true,
        message: 'No weather alerts at the moment',
        alerts: []
      });
    }
    
    const summary = await notificationService.processWeatherAlerts(db, locationAlerts);
    
    res.status(200).send({
      success: true,
      message: 'Check completed',
      summary: summary
    });
    
  } catch (error) {
    console.error('Error during manual check:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para verificar status da API (Open-Meteo não tem limites rígidos)
app.get('/api/weather-status', (req, res) => {
  try {
    res.status(200).send({
      success: true,
      api: 'Open-Meteo',
      description: 'Free API with no strict rate limits',
      features: [
        'Current and forecast rain',
        'UV index',
        'Air quality',
        'Wind speed and gusts'
      ],
      message: 'System operational'
    });
    
  } catch (error) {
    console.error('Error getting status:', error);
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
    
    console.log(`\n=== USER DIAGNOSIS ${uid} ===\n`);
    
    // 1. Verificar usuário
    const userQuery = 'SELECT * FROM users WHERE uid = $1';
    const { rows: users } = await db.query(userQuery, [uid]);
    
    if (users.length === 0) {
      return res.status(404).send({
        success: false,
        error: 'User not found in the database',
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
      problems.push("User location isn't set");
    }
    
    if (devices.length === 0) {
      problems.push('No registered devices');
    } else {
      devices.forEach((device, index) => {
        if (!device.token) {
          problems.push(`Device ${index + 1} has no FCM token`);
        }
      });
    }
    
    const activeCooldowns = cooldowns.filter(cd => {
      const minutesAgo = Math.floor((Date.now() - new Date(cd.last_notification_at).getTime()) / 1000 / 60);
      return minutesAgo < 60;
    });
    
    if (activeCooldowns.length > 0) {
      warnings.push(`${activeCooldowns.length} active cooldown(s) - the user won't receive notifications for those locations for up to 1 hour`);
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
    console.error('Error diagnosing user:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ PostgreSQL database connection successful!');
    console.log('Current time returned by DB:', result.rows[0].now);
  } catch (err) {
    console.error('❌ ERROR CONNECTING TO DATABASE ON STARTUP:', err.stack);
  }
});
