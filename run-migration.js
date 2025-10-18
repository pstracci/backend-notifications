// Script para executar migrations do banco de dados
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration(migrationFile) {
  try {
    console.log(`\n📄 Executando migration: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    
    console.log(`✅ Migration ${migrationFile} executada com sucesso!`);
  } catch (error) {
    console.error(`❌ Erro ao executar migration ${migrationFile}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Iniciando execução de migrations...\n');
    
    // Executar migration de cooldown
    await runMigration('003_create_notification_cooldown.sql');
    
    // Atualizar cooldown para nível de usuário
    await runMigration('004_update_cooldown_per_user.sql');
    
    console.log('\n✅ Todas as migrations foram executadas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
}

main();
