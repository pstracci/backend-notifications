// Script Node.js para validar e corrigir o banco de dados
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function validateAndFix() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'weather_alerts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('============================================');
    console.log('🔍 INICIANDO VALIDAÇÃO E CORREÇÃO DO BANCO');
    console.log('============================================\n');

    const client = await pool.connect();

    // PARTE 1: Verificar tabelas existentes
    console.log('📋 TABELAS EXISTENTES:');
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    tablesResult.rows.forEach(row => console.log(`  - ${row.tablename}`));

    // PARTE 2: Validar e corrigir DEVICES
    console.log('\n============================================');
    console.log('🔧 VALIDANDO TABELA DEVICES');
    console.log('============================================\n');

    // Adicionar user_id se não existir
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'devices' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE devices ADD COLUMN user_id INTEGER;
          RAISE NOTICE '✅ Coluna user_id adicionada';
        END IF;
      END $$;
    `);

    // Adicionar FK
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_device_user'
        ) THEN
          ALTER TABLE devices 
            ADD CONSTRAINT fk_device_user 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          RAISE NOTICE '✅ FK fk_device_user criada';
        END IF;
      END $$;
    `);

    // Remover constraint antiga
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'devices_token_key'
        ) THEN
          ALTER TABLE devices DROP CONSTRAINT devices_token_key;
          RAISE NOTICE '✅ Constraint devices_token_key removida';
        END IF;
      END $$;
    `);

    // Adicionar constraint correta
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'unique_user_token'
        ) THEN
          ALTER TABLE devices 
            ADD CONSTRAINT unique_user_token 
            UNIQUE(user_id, token);
          RAISE NOTICE '✅ Constraint unique_user_token criada';
        END IF;
      END $$;
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`);

    // Verificar estrutura devices
    const devicesStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'devices'
      ORDER BY ordinal_position
    `);
    console.log('📊 Estrutura da tabela devices:');
    console.table(devicesStructure.rows);

    // PARTE 3: Validar e corrigir NOTIFICATION_COOLDOWN
    console.log('\n============================================');
    console.log('🔧 VALIDANDO TABELA NOTIFICATION_COOLDOWN');
    console.log('============================================\n');

    // Criar tabela se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_cooldown (
        id SERIAL PRIMARY KEY,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Adicionar user_id
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'notification_cooldown' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE notification_cooldown ADD COLUMN user_id INTEGER;
          RAISE NOTICE '✅ Coluna user_id adicionada';
        END IF;
      END $$;
    `);

    // Adicionar alert_type
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'notification_cooldown' AND column_name = 'alert_type'
        ) THEN
          ALTER TABLE notification_cooldown ADD COLUMN alert_type VARCHAR(50);
          UPDATE notification_cooldown SET alert_type = 'rain_now' WHERE alert_type IS NULL;
          ALTER TABLE notification_cooldown ALTER COLUMN alert_type SET NOT NULL;
          RAISE NOTICE '✅ Coluna alert_type adicionada';
        END IF;
      END $$;
    `);

    // Limpar NULLs e tornar user_id NOT NULL
    await client.query(`DELETE FROM notification_cooldown WHERE user_id IS NULL`);
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE notification_cooldown ALTER COLUMN user_id SET NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    // Remover colunas antigas
    await client.query(`ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS intensity_level`);
    await client.query(`ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS precipitation`);

    // Remover constraints antigas
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'notification_cooldown_latitude_longitude_key'
        ) THEN
          ALTER TABLE notification_cooldown DROP CONSTRAINT notification_cooldown_latitude_longitude_key;
          RAISE NOTICE '✅ Constraint antiga removida';
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'unique_user_location'
        ) THEN
          ALTER TABLE notification_cooldown DROP CONSTRAINT unique_user_location;
          RAISE NOTICE '✅ Constraint unique_user_location removida';
        END IF;
      END $$;
    `);

    // Adicionar FK
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_cooldown_user'
        ) THEN
          ALTER TABLE notification_cooldown 
            ADD CONSTRAINT fk_cooldown_user 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          RAISE NOTICE '✅ FK fk_cooldown_user criada';
        END IF;
      END $$;
    `);

    // Adicionar constraint correta
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'unique_user_location_alert'
        ) THEN
          ALTER TABLE notification_cooldown 
            ADD CONSTRAINT unique_user_location_alert 
            UNIQUE(user_id, latitude, longitude, alert_type);
          RAISE NOTICE '✅ Constraint unique_user_location_alert criada';
        END IF;
      END $$;
    `);

    // Criar índices
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cooldown_location ON notification_cooldown(latitude, longitude)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cooldown_timestamp ON notification_cooldown(last_notification_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cooldown_user ON notification_cooldown(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cooldown_alert_type ON notification_cooldown(alert_type)`);

    // Verificar estrutura notification_cooldown
    const cooldownStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification_cooldown'
      ORDER BY ordinal_position
    `);
    console.log('📊 Estrutura da tabela notification_cooldown:');
    console.table(cooldownStructure.rows);

    // PARTE 4: Verificar constraints
    console.log('\n============================================');
    console.log('🔒 CONSTRAINTS FINAIS');
    console.log('============================================\n');

    const devicesConstraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'devices'
      ORDER BY constraint_type
    `);
    console.log('Constraints da tabela devices:');
    console.table(devicesConstraints.rows);

    const cooldownConstraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'notification_cooldown'
      ORDER BY constraint_type
    `);
    console.log('\nConstraints da tabela notification_cooldown:');
    console.table(cooldownConstraints.rows);

    // PARTE 5: Estatísticas
    console.log('\n============================================');
    console.log('📈 ESTATÍSTICAS');
    console.log('============================================\n');

    const stats = await client.query(`
      SELECT 'users' as tabela, COUNT(*) as total FROM users
      UNION ALL
      SELECT 'devices', COUNT(*) FROM devices
      UNION ALL
      SELECT 'notification_cooldown', COUNT(*) FROM notification_cooldown
      ORDER BY tabela
    `);
    console.table(stats.rows);

    // Verificação final
    const hasCorrectConstraint = cooldownConstraints.rows.some(
      row => row.constraint_name === 'unique_user_location_alert'
    );

    console.log('\n============================================');
    console.log('✅ VALIDAÇÃO CONCLUÍDA!');
    console.log('============================================\n');

    if (hasCorrectConstraint) {
      console.log('🎉 SUCESSO! Todas as correções foram aplicadas.');
      console.log('✓ Constraint unique_user_location_alert está presente');
      console.log('✓ Banco de dados pronto para uso!\n');
    } else {
      console.log('⚠️ ATENÇÃO: Constraint unique_user_location_alert não encontrada!');
      console.log('Execute o script SQL manualmente.\n');
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('\n❌ ERRO durante validação:', error.message);
    console.error(error);
    process.exit(1);
  }
}

validateAndFix();
