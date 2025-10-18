// Script para configurar o sistema de cooldown (migrations 003 e 004)
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function tableExists(tableName) {
  const { rows } = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = $1;
  `, [tableName]);
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const { rows } = await db.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2;
  `, [tableName, columnName]);
  return rows.length > 0;
}

async function runMigration(migrationFile) {
  try {
    console.log(`\n📄 Executando: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    
    console.log(`✅ ${migrationFile} executada com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro em ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Configurando sistema de cooldown...\n');
    
    // Verificar se a tabela existe
    const exists = await tableExists('notification_cooldown');
    
    if (!exists) {
      console.log('📋 Tabela notification_cooldown não existe');
      console.log('   → Criando tabela (migration 003)...');
      await runMigration('003_create_notification_cooldown.sql');
    } else {
      console.log('✅ Tabela notification_cooldown já existe');
    }
    
    // Verificar se precisa atualizar para incluir user_id
    const hasUserId = await columnExists('notification_cooldown', 'user_id');
    
    if (!hasUserId) {
      console.log('\n📋 Coluna user_id não existe');
      console.log('   → Atualizando para cooldown por usuário (migration 004)...');
      
      // Limpar dados antigos antes de adicionar user_id
      console.log('   → Limpando dados antigos da tabela...');
      await db.query('TRUNCATE TABLE notification_cooldown;');
      
      await runMigration('004_update_cooldown_per_user.sql');
    } else {
      console.log('✅ Coluna user_id já existe - estrutura atualizada!');
    }
    
    // Verificar estrutura final
    console.log('\n📊 Estrutura final da tabela:');
    const { rows: columns } = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position;
    `);
    
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n✅ Sistema de cooldown configurado com sucesso!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erro ao configurar cooldown:', error);
    process.exit(1);
  }
}

main();
