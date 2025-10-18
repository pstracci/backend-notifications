-- ============================================
-- CORREÇÃO COMPLETA: Cooldown por Usuário
-- ============================================
-- Este script aplica TODAS as correções necessárias
-- Execute este SQL diretamente no banco de dados de produção

-- ============================================
-- PARTE 1: Adicionar user_id na tabela devices
-- ============================================

-- Adicionar coluna user_id
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Adicionar foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_device_user'
    AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices 
      ADD CONSTRAINT fk_device_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Foreign key fk_device_user criada';
  END IF;
END $$;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Remover constraint antiga de token único global
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'devices_token_key'
    AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices DROP CONSTRAINT devices_token_key;
    RAISE NOTICE 'Constraint devices_token_key removida';
  END IF;
END $$;

-- Adicionar constraint única (user_id, token)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_token'
    AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices 
      ADD CONSTRAINT unique_user_token 
      UNIQUE(user_id, token);
    RAISE NOTICE 'Constraint unique_user_token criada';
  END IF;
END $$;

-- ============================================
-- PARTE 2: Criar/Atualizar tabela notification_cooldown
-- ============================================

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS notification_cooldown (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
  intensity_level VARCHAR(20) NOT NULL,
  precipitation DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar coluna user_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_cooldown' 
    AND column_name = 'user_id'
  ) THEN
    -- Limpar dados antigos antes de adicionar user_id
    TRUNCATE TABLE notification_cooldown;
    
    -- Adicionar coluna user_id
    ALTER TABLE notification_cooldown ADD COLUMN user_id INTEGER;
    
    -- Tornar coluna NOT NULL
    ALTER TABLE notification_cooldown ALTER COLUMN user_id SET NOT NULL;
    
    RAISE NOTICE 'Coluna user_id adicionada em notification_cooldown';
  ELSE
    RAISE NOTICE 'Coluna user_id já existe em notification_cooldown';
  END IF;
END $$;

-- Remover constraint antiga se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notification_cooldown_latitude_longitude_key'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      DROP CONSTRAINT notification_cooldown_latitude_longitude_key;
    RAISE NOTICE 'Constraint antiga de notification_cooldown removida';
  END IF;
END $$;

-- Adicionar foreign key se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_cooldown_user'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      ADD CONSTRAINT fk_cooldown_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Foreign key fk_cooldown_user criada';
  END IF;
END $$;

-- Criar constraint única se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_location'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      ADD CONSTRAINT unique_user_location 
      UNIQUE(user_id, latitude, longitude);
    RAISE NOTICE 'Constraint unique_user_location criada';
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cooldown_location ON notification_cooldown(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cooldown_timestamp ON notification_cooldown(last_notification_at);
CREATE INDEX IF NOT EXISTS idx_cooldown_user ON notification_cooldown(user_id);

-- ============================================
-- PARTE 3: Comentários e Documentação
-- ============================================

COMMENT ON COLUMN devices.user_id IS 'ID do usuário dono do dispositivo';
COMMENT ON TABLE notification_cooldown IS 'Controla cooldown de 1 hora para notificações por usuário e região';
COMMENT ON COLUMN notification_cooldown.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN notification_cooldown.latitude IS 'Latitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.longitude IS 'Longitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.last_notification_at IS 'Timestamp da última notificação enviada para este usuário nesta região';

-- ============================================
-- PARTE 4: Verificação Final
-- ============================================

-- Verificar estrutura da tabela devices
SELECT '=== ESTRUTURA DA TABELA DEVICES ===' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'devices'
ORDER BY ordinal_position;

-- Verificar estrutura da tabela notification_cooldown
SELECT '=== ESTRUTURA DA TABELA NOTIFICATION_COOLDOWN ===' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT '=== CONSTRAINTS ===' as info;
SELECT 
  table_name,
  constraint_name, 
  constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('devices', 'notification_cooldown')
ORDER BY table_name, constraint_type;

-- Sucesso!
SELECT '✅ MIGRAÇÃO COMPLETA CONCLUÍDA COM SUCESSO!' as status;
