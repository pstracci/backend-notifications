// Script para verificar estrutura da tabela notification_cooldown
const { Pool } = require('pg');

async function verifyTable() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'weather_alerts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('🔍 Verificando estrutura da tabela notification_cooldown...\n');
    
    // Verificar colunas
    console.log('📋 COLUNAS:');
    const columnsResult = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    console.table(columnsResult.rows);
    
    // Verificar constraints
    console.log('\n🔒 CONSTRAINTS:');
    const constraintsResult = await pool.query(`
      SELECT 
        constraint_name, 
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'notification_cooldown'
      ORDER BY constraint_type, constraint_name
    `);
    console.table(constraintsResult.rows);
    
    // Verificar índices
    console.log('\n📊 ÍNDICES:');
    const indexesResult = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'notification_cooldown'
      ORDER BY indexname
    `);
    console.table(indexesResult.rows);
    
    // Verificar se a constraint correta existe
    const correctConstraint = constraintsResult.rows.find(
      row => row.constraint_name === 'unique_user_location_alert'
    );
    
    if (correctConstraint) {
      console.log('\n✅ SUCESSO: Constraint unique_user_location_alert encontrada!');
    } else {
      console.log('\n⚠️ ATENÇÃO: Constraint unique_user_location_alert NÃO encontrada!');
      console.log('Execute novamente a migration 006.');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error);
    process.exit(1);
  }
}

verifyTable();
