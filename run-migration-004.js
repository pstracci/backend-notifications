// Script para executar apenas a migration 004 (atualização de cooldown)
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  try {
    console.log('🚀 Executando migration 004: Atualização de cooldown para nível de usuário\n');
    
    const migrationPath = path.join(__dirname, 'migrations', '004_update_cooldown_per_user.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 SQL a ser executado:');
    console.log(sql);
    console.log('\n⏳ Executando...\n');
    
    await db.query(sql);
    
    console.log('✅ Migration 004 executada com sucesso!');
    console.log('\n📊 Verificando estrutura da tabela...\n');
    
    // Verificar estrutura da tabela
    const { rows } = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position;
    `);
    
    console.log('Colunas da tabela notification_cooldown:');
    rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

runMigration();
