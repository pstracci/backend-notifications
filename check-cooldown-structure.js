const db = require('./db');

(async () => {
  try {
    console.log('=== Estrutura da tabela notification_cooldown ===\n');
    
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n=== Constraints ===\n');
    const constraints = await db.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'notification_cooldown'
    `);
    
    constraints.rows.forEach(c => {
      console.log(`  - ${c.constraint_name}: ${c.constraint_type}`);
    });
    
    console.log('\n=== Últimos registros ===\n');
    const recent = await db.query(`
      SELECT user_id, latitude, longitude, alert_type, severity, alert_value, 
             last_notification_at, 
             EXTRACT(EPOCH FROM (NOW() - last_notification_at))/60 as minutes_ago
      FROM notification_cooldown
      ORDER BY last_notification_at DESC
      LIMIT 10
    `);
    
    if (recent.rows.length > 0) {
      recent.rows.forEach(r => {
        console.log(`  User ${r.user_id} | ${r.latitude}, ${r.longitude} | ${r.alert_type}`);
        console.log(`    Severity: ${r.severity} | Value: ${r.alert_value}`);
        console.log(`    ${Math.floor(r.minutes_ago)} minutos atrás\n`);
      });
    } else {
      console.log('  Nenhum registro encontrado');
    }
    
    await db.end();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
})();
