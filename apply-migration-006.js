// Script para aplicar migration 006
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'weather_alerts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    const client = await pool.connect();
    
    console.log('📖 Lendo arquivo de migration...');
    const migrationPath = path.join(__dirname, 'migrations', '006_add_alert_type_to_cooldown.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executando migration 006...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration aplicada com sucesso!');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    process.exit(1);
  }
}

applyMigration();
