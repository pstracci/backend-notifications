const db = require('./db');

async function diagnoseCooldown() {
  try {
    console.log('🔍 DIAGNÓSTICO DO SISTEMA DE COOLDOWN\n');
    console.log('='.repeat(60));
    
    // 1. Verificar estrutura da tabela
    console.log('\n📋 1. ESTRUTURA DA TABELA\n');
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    
    const hasAlertType = columns.rows.some(c => c.column_name === 'alert_type');
    const hasSeverity = columns.rows.some(c => c.column_name === 'severity');
    const hasSeverityWithSpace = columns.rows.some(c => c.column_name === 'severity ');
    const hasAlertValue = columns.rows.some(c => c.column_name === 'alert_value');
    
    console.log('Colunas encontradas:');
    columns.rows.forEach(col => {
      const status = col.column_name === 'alert_type' || 
                     col.column_name === 'severity' || 
                     col.column_name === 'alert_value' ? '✅' : '  ';
      console.log(`  ${status} ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    console.log('\n📊 Status das colunas críticas:');
    console.log(`  ${hasAlertType ? '✅' : '❌'} alert_type: ${hasAlertType ? 'OK' : 'FALTANDO - Execute migration 006'}`);
    
    if (hasSeverityWithSpace) {
      console.log(`  🚨 severity: ERRO - Coluna tem ESPAÇO EXTRA no nome ("severity ")!`);
      console.log(`     ⚠️  Execute migration 008 para corrigir!`);
    } else {
      console.log(`  ${hasSeverity ? '✅' : '❌'} severity: ${hasSeverity ? 'OK' : 'FALTANDO - Execute migration 007'}`);
    }
    
    console.log(`  ${hasAlertValue ? '✅' : '❌'} alert_value: ${hasAlertValue ? 'OK' : 'FALTANDO - Execute migration 007'}`);
    
    // 2. Verificar constraints
    console.log('\n🔒 2. CONSTRAINTS\n');
    const constraints = await db.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'notification_cooldown'
    `);
    
    const hasUniqueConstraint = constraints.rows.some(c => 
      c.constraint_name === 'unique_user_location_alert' && c.constraint_type === 'UNIQUE'
    );
    
    console.log('Constraints encontradas:');
    constraints.rows.forEach(c => {
      const status = c.constraint_name === 'unique_user_location_alert' ? '✅' : '  ';
      console.log(`  ${status} ${c.constraint_name.padEnd(35)} ${c.constraint_type}`);
    });
    
    console.log(`\n  ${hasUniqueConstraint ? '✅' : '❌'} UNIQUE constraint: ${hasUniqueConstraint ? 'OK' : 'FALTANDO - Execute migration 006'}`);
    
    // 3. Verificar registros recentes
    console.log('\n📝 3. REGISTROS RECENTES (últimas 2 horas)\n');
    const recent = await db.query(`
      SELECT 
        user_id, 
        latitude, 
        longitude, 
        alert_type,
        severity,
        alert_value,
        last_notification_at,
        EXTRACT(EPOCH FROM (NOW() - last_notification_at))/60 as minutes_ago
      FROM notification_cooldown
      WHERE last_notification_at > NOW() - INTERVAL '2 hours'
      ORDER BY last_notification_at DESC
      LIMIT 15
    `);
    
    if (recent.rows.length > 0) {
      console.log(`Total de registros ativos: ${recent.rows.length}\n`);
      
      recent.rows.forEach((r, i) => {
        const minutesAgo = Math.floor(r.minutes_ago);
        const inCooldown = minutesAgo < 60 ? '🔴 EM COOLDOWN' : '🟢 EXPIRADO';
        
        console.log(`${i + 1}. User ${r.user_id} | ${r.latitude}, ${r.longitude}`);
        console.log(`   Tipo: ${r.alert_type || 'NULL'} | Severity: ${r.severity || 'NULL'} | Value: ${r.alert_value || 'NULL'}`);
        console.log(`   ${inCooldown} (${minutesAgo} min atrás)\n`);
      });
    } else {
      console.log('  ℹ️  Nenhum registro encontrado nas últimas 2 horas\n');
    }
    
    // 4. Verificar arredondamento de coordenadas
    console.log('🎯 4. VERIFICAÇÃO DE ARREDONDAMENTO\n');
    const coordCheck = await db.query(`
      SELECT 
        latitude,
        longitude,
        COUNT(*) as count
      FROM notification_cooldown
      WHERE last_notification_at > NOW() - INTERVAL '2 hours'
      GROUP BY latitude, longitude
      ORDER BY count DESC
      LIMIT 5
    `);
    
    if (coordCheck.rows.length > 0) {
      console.log('Coordenadas mais frequentes:');
      coordCheck.rows.forEach(r => {
        const latDecimals = (r.latitude.toString().split('.')[1] || '').length;
        const lonDecimals = (r.longitude.toString().split('.')[1] || '').length;
        const isRounded = latDecimals <= 2 && lonDecimals <= 2;
        
        console.log(`  ${isRounded ? '✅' : '❌'} ${r.latitude}, ${r.longitude} (${r.count} registros)`);
        if (!isRounded) {
          console.log(`     ⚠️  Coordenadas NÃO arredondadas! (${latDecimals} e ${lonDecimals} casas decimais)`);
        }
      });
    } else {
      console.log('  ℹ️  Nenhum registro para verificar\n');
    }
    
    // 5. Estatísticas gerais
    console.log('\n📊 5. ESTATÍSTICAS GERAIS\n');
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT alert_type) as unique_alert_types,
        COUNT(CASE WHEN severity IS NOT NULL THEN 1 END) as records_with_severity,
        COUNT(CASE WHEN alert_value IS NOT NULL THEN 1 END) as records_with_value
      FROM notification_cooldown
      WHERE last_notification_at > NOW() - INTERVAL '24 hours'
    `);
    
    if (stats.rows.length > 0) {
      const s = stats.rows[0];
      console.log(`  Total de registros (24h): ${s.total_records}`);
      console.log(`  Usuários únicos: ${s.unique_users}`);
      console.log(`  Tipos de alerta únicos: ${s.unique_alert_types}`);
      console.log(`  Registros com severity: ${s.records_with_severity} (${s.total_records > 0 ? Math.round(s.records_with_severity/s.total_records*100) : 0}%)`);
      console.log(`  Registros com alert_value: ${s.records_with_value} (${s.total_records > 0 ? Math.round(s.records_with_value/s.total_records*100) : 0}%)`);
    }
    
    // 6. Alertas por tipo
    if (hasAlertType) {
      console.log('\n📈 6. DISTRIBUIÇÃO POR TIPO DE ALERTA\n');
      const byType = await db.query(`
        SELECT 
          alert_type,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (NOW() - last_notification_at))/60) as avg_minutes_ago
        FROM notification_cooldown
        WHERE last_notification_at > NOW() - INTERVAL '24 hours'
        GROUP BY alert_type
        ORDER BY count DESC
      `);
      
      if (byType.rows.length > 0) {
        byType.rows.forEach(r => {
          console.log(`  ${r.alert_type.padEnd(20)} ${r.count} registros (média: ${Math.floor(r.avg_minutes_ago)} min atrás)`);
        });
      } else {
        console.log('  ℹ️  Nenhum registro nas últimas 24 horas\n');
      }
    }
    
    // 7. Resumo e recomendações
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO E RECOMENDAÇÕES\n');
    
    const issues = [];
    const recommendations = [];
    
    if (!hasAlertType) {
      issues.push('❌ Coluna alert_type não encontrada');
      recommendations.push('Execute: node apply-migration-006.js');
    }
    
    if (hasSeverityWithSpace) {
      issues.push('🚨 Coluna "severity " tem ESPAÇO EXTRA no nome!');
      recommendations.push('Execute: node apply-migration-008.js (URGENTE!)');
    } else if (!hasSeverity) {
      issues.push('❌ Coluna severity não encontrada');
      recommendations.push('Execute: node apply-migration-007.js');
    }
    
    if (!hasAlertValue) {
      issues.push('❌ Coluna alert_value não encontrada');
      recommendations.push('Execute: node apply-migration-007.js');
    }
    
    if (!hasUniqueConstraint) {
      issues.push('❌ Constraint UNIQUE não encontrada');
      recommendations.push('Execute: node apply-migration-006.js');
    }
    
    if (coordCheck.rows.length > 0) {
      const hasUnrounded = coordCheck.rows.some(r => {
        const latDecimals = (r.latitude.toString().split('.')[1] || '').length;
        const lonDecimals = (r.longitude.toString().split('.')[1] || '').length;
        return latDecimals > 2 || lonDecimals > 2;
      });
      
      if (hasUnrounded) {
        issues.push('⚠️  Coordenadas não arredondadas encontradas');
        recommendations.push('Reinicie o servidor para carregar código atualizado');
        recommendations.push('Limpe registros antigos: DELETE FROM notification_cooldown WHERE last_notification_at < NOW() - INTERVAL \'2 hours\'');
      }
    }
    
    if (stats.rows.length > 0 && stats.rows[0].total_records > 0) {
      const s = stats.rows[0];
      const severityPercent = Math.round(s.records_with_severity/s.total_records*100);
      const valuePercent = Math.round(s.records_with_value/s.total_records*100);
      
      if (severityPercent < 90) {
        issues.push(`⚠️  Apenas ${severityPercent}% dos registros têm severity`);
        recommendations.push('Verifique se o código atualizado está rodando');
      }
      
      if (valuePercent < 90) {
        issues.push(`⚠️  Apenas ${valuePercent}% dos registros têm alert_value`);
        recommendations.push('Verifique se o código atualizado está rodando');
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ TUDO OK! Sistema de cooldown funcionando corretamente.\n');
    } else {
      console.log('⚠️  PROBLEMAS ENCONTRADOS:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
      
      console.log('\n💡 RECOMENDAÇÕES:\n');
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    await db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erro ao executar diagnóstico:', error);
    await db.end();
    process.exit(1);
  }
}

diagnoseCooldown();
