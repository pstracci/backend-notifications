const { Pool } = require('pg');

// Carregar variáveis de ambiente se disponível
try {
  require('dotenv').config();
} catch (e) {
  // dotenv não instalado, usar variáveis de ambiente do sistema
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function diagnoseUser(uid) {
  try {
    console.log('\n=== DIAGNÓSTICO DO USUÁRIO ===');
    console.log(`UID: ${uid}\n`);
    
    // 1. Verificar usuário
    const userQuery = 'SELECT * FROM users WHERE uid = $1';
    const { rows: users } = await db.query(userQuery, [uid]);
    
    if (users.length === 0) {
      console.log('❌ PROBLEMA: Usuário não encontrado no banco de dados!');
      return;
    }
    
    const user = users[0];
    console.log('✅ Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email || 'não definido'}`);
    console.log(`   Nome: ${user.name || 'não definido'}`);
    console.log(`   Localização: ${user.latitude}, ${user.longitude}`);
    console.log(`   Última atualização: ${user.location_updated_at}`);
    console.log(`   Criado em: ${user.created_at}\n`);
    
    // 2. Verificar dispositivos
    const devicesQuery = 'SELECT * FROM devices WHERE user_id = $1';
    const { rows: devices } = await db.query(devicesQuery, [user.id]);
    
    console.log(`📱 Dispositivos registrados: ${devices.length}`);
    
    if (devices.length === 0) {
      console.log('❌ PROBLEMA: Nenhum dispositivo registrado para este usuário!');
      console.log('   O app precisa chamar /register-device com o token FCM.');
      return;
    }
    
    devices.forEach((device, index) => {
      console.log(`\n   Dispositivo ${index + 1}:`);
      console.log(`   ID: ${device.id}`);
      console.log(`   Token (primeiros 50 chars): ${device.token ? device.token.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`   Token completo: ${device.token || 'NULL'}`);
      console.log(`   Criado em: ${device.created_at}`);
    });
    
    // 3. Verificar cooldown
    const cooldownQuery = `
      SELECT * FROM notification_cooldown 
      WHERE user_id = $1
      ORDER BY last_notification_at DESC
    `;
    const { rows: cooldowns } = await db.query(cooldownQuery, [user.id]);
    
    console.log(`\n⏱️ Histórico de cooldown: ${cooldowns.length} registro(s)`);
    
    if (cooldowns.length > 0) {
      cooldowns.forEach((cd, index) => {
        const minutesAgo = Math.floor((Date.now() - new Date(cd.last_notification_at).getTime()) / 1000 / 60);
        const isActive = minutesAgo < 60;
        
        console.log(`\n   Cooldown ${index + 1}:`);
        console.log(`   Localização: ${cd.latitude}, ${cd.longitude}`);
        console.log(`   Intensidade: ${cd.intensity_level}`);
        console.log(`   Precipitação: ${cd.precipitation} mm/h`);
        console.log(`   Última notificação: ${cd.last_notification_at}`);
        console.log(`   Tempo desde última: ${minutesAgo} minutos`);
        console.log(`   Status: ${isActive ? '🔴 ATIVO (bloqueando notificações)' : '🟢 INATIVO'}`);
      });
    } else {
      console.log('   Nenhum cooldown ativo - usuário pode receber notificações');
    }
    
    // 4. Verificar se há previsões de chuva para a localização do usuário
    console.log('\n🌧️ Verificando localizações próximas no banco...');
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
    
    console.log(`   Encontradas ${nearby.length} localização(ões) próximas:`);
    nearby.forEach((loc, index) => {
      const distance = Math.sqrt(
        Math.pow(loc.latitude - user.latitude, 2) + 
        Math.pow(loc.longitude - user.longitude, 2)
      ) * 111; // Aproximação em km
      
      console.log(`   ${index + 1}. ${loc.latitude}, ${loc.longitude} (${loc.user_count} usuário(s), ~${distance.toFixed(2)} km)`);
    });
    
    // 5. Resumo e diagnóstico
    console.log('\n=== RESUMO DO DIAGNÓSTICO ===');
    
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
    
    if (problems.length > 0) {
      console.log('\n❌ PROBLEMAS ENCONTRADOS:');
      problems.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ AVISOS:');
      warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
    }
    
    if (problems.length === 0 && warnings.length === 0) {
      console.log('✅ Tudo parece estar configurado corretamente!');
      console.log('   Se ainda não está recebendo notificações, verifique:');
      console.log('   1. Se o token FCM é válido (teste com /api/test-notification)');
      console.log('   2. Se há chuva prevista para sua localização');
      console.log('   3. Se as permissões de notificação estão habilitadas no app');
    }
    
    console.log('\n=====================================\n');
    
  } catch (error) {
    console.error('Erro ao diagnosticar usuário:', error);
  } finally {
    await db.end();
  }
}

// Executar diagnóstico
const uid = process.argv[2] || 'jt9h3DQIUfg5CqLW0oGKErBXY6u1';
diagnoseUser(uid);
