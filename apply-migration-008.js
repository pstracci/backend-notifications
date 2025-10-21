const db = require('./db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('🔧 Aplicando Migration 008: Corrigir nome da coluna severity\n');
    console.log('⚠️  PROBLEMA: A coluna "severity " tem um espaço extra no final!\n');
    
    // Verificar se a coluna com espaço existe
    console.log('🔍 Verificando estrutura atual...');
    const checkColumn = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
        AND column_name LIKE 'severity%'
    `);
    
    console.log('\nColunas encontradas:');
    checkColumn.rows.forEach(row => {
      const hasSpace = row.column_name.includes(' ');
      console.log(`  ${hasSpace ? '❌' : '✅'} "${row.column_name}" ${hasSpace ? '(TEM ESPAÇO!)' : ''}`);
    });
    
    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'migrations', '008_fix_severity_column_name.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Executar migration
    console.log('\n📝 Executando migration...');
    await db.query(migrationSQL);
    
    console.log('\n✅ Migration aplicada com sucesso!\n');
    
    // Verificar estrutura final
    console.log('📊 Estrutura final das colunas:\n');
    const { rows } = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    
    rows.forEach(col => {
      const highlight = ['severity', 'alert_type', 'alert_value'].includes(col.column_name) ? '✅' : '  ';
      console.log(`  ${highlight} ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    console.log('\n🎉 Tudo pronto! A coluna severity agora está correta.\n');
    console.log('📌 Mudanças aplicadas:');
    console.log('   1. ✅ Coluna "severity " renomeada para "severity"');
    console.log('   2. ✅ Índice recriado');
    console.log('   3. ✅ Agora o código pode inserir dados corretamente\n');
    
    console.log('⚠️  IMPORTANTE: Reinicie o servidor após aplicar esta migration!\n');
    
    await db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    console.error('\nDetalhes:', error.message);
    await db.end();
    process.exit(1);
  }
}

applyMigration();
