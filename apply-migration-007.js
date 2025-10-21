const db = require('./db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('🔧 Aplicando Migration 007: Adicionar severity e alert_value ao cooldown\n');
    
    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'migrations', '007_add_severity_and_value_to_cooldown.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Executar migration
    console.log('📝 Executando migration...');
    await db.query(migrationSQL);
    
    console.log('\n✅ Migration aplicada com sucesso!\n');
    
    // Limpar registros antigos (mais de 2 horas)
    console.log('🧹 Limpando registros antigos de cooldown (> 2 horas)...');
    const deleteResult = await db.query(`
      DELETE FROM notification_cooldown
      WHERE last_notification_at < NOW() - INTERVAL '2 hours'
    `);
    
    console.log(`✅ ${deleteResult.rowCount} registro(s) antigo(s) removido(s)\n`);
    
    // Verificar estrutura final
    console.log('📊 Estrutura final da tabela:\n');
    const { rows } = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    
    rows.forEach(col => {
      console.log(`  ✓ ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    console.log('\n🎉 Tudo pronto! O cooldown agora está corrigido.\n');
    console.log('📌 Mudanças aplicadas:');
    console.log('   1. ✅ Coordenadas são arredondadas para 2 casas decimais');
    console.log('   2. ✅ Colunas severity e alert_value adicionadas');
    console.log('   3. ✅ Valores de severity e alert_value são salvos no cooldown');
    console.log('   4. ✅ Registros antigos foram limpos\n');
    
    await db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    await db.end();
    process.exit(1);
  }
}

applyMigration();
