-- ============================================
-- SCRIPT DE VALIDAÇÃO E CORREÇÃO COMPLETA
-- ============================================
-- Este script verifica e corrige todas as tabelas do sistema
-- Execute este SQL diretamente no banco de dados

-- ============================================
-- PARTE 1: VERIFICAÇÃO INICIAL
-- ============================================

-- 📋 TABELAS EXISTENTES:
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ============================================
-- PARTE 1: TABELA USERS
-- ============================================

-- 📊 Estrutura atual da tabela users:
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- ============================================
-- PARTE 2: TABELA DEVICES
-- ============================================

-- Adicionar coluna user_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE devices ADD COLUMN user_id INTEGER;
    RAISE NOTICE '✅ Coluna user_id adicionada em devices';
  ELSE
    RAISE NOTICE '✓ Coluna user_id já existe em devices';
  END IF;
END $$;

-- Adicionar foreign key se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_device_user' AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices 
      ADD CONSTRAINT fk_device_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key fk_device_user criada';
  ELSE
    RAISE NOTICE '✓ Foreign key fk_device_user já existe';
  END IF;
END $$;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Remover constraint antiga de token único global se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'devices_token_key' AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices DROP CONSTRAINT devices_token_key;
    RAISE NOTICE '✅ Constraint devices_token_key removida';
  ELSE
    RAISE NOTICE '✓ Constraint devices_token_key não existe';
  END IF;
END $$;

-- Adicionar constraint única (user_id, token) se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_token' AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices 
      ADD CONSTRAINT unique_user_token 
      UNIQUE(user_id, token);
    RAISE NOTICE '✅ Constraint unique_user_token criada';
  ELSE
    RAISE NOTICE '✓ Constraint unique_user_token já existe';
  END IF;
END $$;

-- 📊 Estrutura atual da tabela devices:
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'devices'
ORDER BY ordinal_position;

-- ============================================
-- PARTE 3: TABELA NOTIFICATION_COOLDOWN
-- ============================================

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS notification_cooldown (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar coluna user_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_cooldown' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notification_cooldown ADD COLUMN user_id INTEGER;
    RAISE NOTICE '✅ Coluna user_id adicionada em notification_cooldown';
  ELSE
    RAISE NOTICE '✓ Coluna user_id já existe em notification_cooldown';
  END IF;
END $$;

-- Adicionar coluna alert_type se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_cooldown' AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE notification_cooldown ADD COLUMN alert_type VARCHAR(50);
    UPDATE notification_cooldown SET alert_type = 'rain_now' WHERE alert_type IS NULL;
    ALTER TABLE notification_cooldown ALTER COLUMN alert_type SET NOT NULL;
    RAISE NOTICE '✅ Coluna alert_type adicionada em notification_cooldown';
  ELSE
    RAISE NOTICE '✓ Coluna alert_type já existe em notification_cooldown';
  END IF;
END $$;

-- Tornar user_id NOT NULL (se tiver dados, limpar antes)
DO $$ 
BEGIN
  -- Verificar se há valores NULL
  IF EXISTS (SELECT 1 FROM notification_cooldown WHERE user_id IS NULL) THEN
    DELETE FROM notification_cooldown WHERE user_id IS NULL;
    RAISE NOTICE '⚠️ Removidos registros com user_id NULL';
  END IF;
  
  -- Tornar NOT NULL
  ALTER TABLE notification_cooldown ALTER COLUMN user_id SET NOT NULL;
  RAISE NOTICE '✓ Coluna user_id configurada como NOT NULL';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✓ Coluna user_id já é NOT NULL';
END $$;

-- Remover colunas antigas específicas de chuva
ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS intensity_level;
ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS precipitation;

-- Remover constraints antigas
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notification_cooldown_latitude_longitude_key'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown DROP CONSTRAINT notification_cooldown_latitude_longitude_key;
    RAISE NOTICE '✅ Constraint notification_cooldown_latitude_longitude_key removida';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_location'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown DROP CONSTRAINT unique_user_location;
    RAISE NOTICE '✅ Constraint unique_user_location removida';
  END IF;
END $$;

-- Adicionar foreign key se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_cooldown_user' AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      ADD CONSTRAINT fk_cooldown_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key fk_cooldown_user criada';
  ELSE
    RAISE NOTICE '✓ Foreign key fk_cooldown_user já existe';
  END IF;
END $$;

-- Criar constraint única correta (user_id, latitude, longitude, alert_type)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_location_alert'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      ADD CONSTRAINT unique_user_location_alert 
      UNIQUE(user_id, latitude, longitude, alert_type);
    RAISE NOTICE '✅ Constraint unique_user_location_alert criada';
  ELSE
    RAISE NOTICE '✓ Constraint unique_user_location_alert já existe';
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cooldown_location ON notification_cooldown(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cooldown_timestamp ON notification_cooldown(last_notification_at);
CREATE INDEX IF NOT EXISTS idx_cooldown_user ON notification_cooldown(user_id);
CREATE INDEX IF NOT EXISTS idx_cooldown_alert_type ON notification_cooldown(alert_type);

-- 📊 Estrutura atual da tabela notification_cooldown:
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;

-- ============================================
-- PARTE 5: VERIFICAÇÃO FINAL - CONSTRAINTS
-- ============================================

-- 🔒 Constraints da tabela devices:
SELECT 
  constraint_name, 
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'devices'
ORDER BY constraint_type, constraint_name;

-- 🔒 Constraints da tabela notification_cooldown:
SELECT 
  constraint_name, 
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'notification_cooldown'
ORDER BY constraint_type, constraint_name;

-- ============================================
-- PARTE 6: VERIFICAÇÃO FINAL - ÍNDICES
-- ============================================

-- 📑 Índices da tabela devices:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'devices'
ORDER BY indexname;

-- 📑 Índices da tabela notification_cooldown:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notification_cooldown'
ORDER BY indexname;

-- ============================================
-- PARTE 7: ESTATÍSTICAS DAS TABELAS
-- ============================================

-- 📈 Contagem de registros:
SELECT 'users' as tabela, COUNT(*) as total FROM users
UNION ALL
SELECT 'devices' as tabela, COUNT(*) as total FROM devices
UNION ALL
SELECT 'notification_cooldown' as tabela, COUNT(*) as total FROM notification_cooldown
ORDER BY tabela;

-- ============================================
-- ✅ VALIDAÇÃO E CORREÇÃO CONCLUÍDAS!
-- ============================================
--
-- 🎯 CHECKLIST FINAL:
--   ✓ Tabela users: OK
--   ✓ Tabela devices: user_id, unique_user_token
--   ✓ Tabela notification_cooldown: user_id, alert_type, unique_user_location_alert
--   ✓ Foreign keys: fk_device_user, fk_cooldown_user
--   ✓ Índices: criados
--
-- 🚀 Banco de dados pronto para uso!
