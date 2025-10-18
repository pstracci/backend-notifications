// Script para verificar o status do banco de dados
const db = require('./db');

async function checkDatabase() {
  try {
    console.log('🔍 Verificando status do banco de dados...\n');
    
    // Verificar se a tabela notification_cooldown existe
    const { rows: tables } = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'notification_cooldown';
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabela notification_cooldown NÃO existe');
      console.log('   → Você precisa executar as migrations 003 e 004\n');
      
      // Listar todas as tabelas
      const { rows: allTables } = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      console.log('📋 Tabelas existentes no banco:');
      allTables.forEach(t => console.log(`   - ${t.table_name}`));
      
    } else {
      console.log('✅ Tabela notification_cooldown existe\n');
      
      // Verificar estrutura
      const { rows: columns } = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'notification_cooldown'
        ORDER BY ordinal_position;
      `);
      
      console.log('📊 Estrutura da tabela:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Verificar se tem a coluna user_id
      const hasUserId = columns.some(col => col.column_name === 'user_id');
      
      if (!hasUserId) {
        console.log('\n⚠️  A coluna user_id NÃO existe');
        console.log('   → Você precisa executar a migration 004\n');
      } else {
        console.log('\n✅ Coluna user_id existe - estrutura atualizada!\n');
      }
      
      // Verificar constraints
      const { rows: constraints } = await db.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'notification_cooldown';
      `);
      
      console.log('🔒 Constraints:');
      constraints.forEach(c => {
        console.log(`   - ${c.constraint_name}: ${c.constraint_type}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error.message);
    process.exit(1);
  }
}

checkDatabase();
