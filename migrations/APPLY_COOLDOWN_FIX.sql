-- ============================================
-- CORREÇÃO: Cooldown por Usuário
-- ============================================
-- Este script atualiza o sistema de cooldown de "por região" para "por usuário"
-- Execute este SQL diretamente no banco de dados de produção

-- Passo 1: Criar tabela se não existir
CREATE TABLE IF NOT EXISTS notification_cooldown (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
  intensity_level VARCHAR(20) NOT NULL,
  precipitation DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Passo 2: Adicionar coluna user_id se não existir
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
    
    RAISE NOTICE 'Coluna user_id adicionada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna user_id já existe';
  END IF;
END $$;

-- Passo 3: Remover constraint antiga se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notification_cooldown_latitude_longitude_key'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown 
      DROP CONSTRAINT notification_cooldown_latitude_longitude_key;
    RAISE NOTICE 'Constraint antiga removida';
  END IF;
END $$;

-- Passo 4: Adicionar foreign key se não existir
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
    RAISE NOTICE 'Foreign key adicionada';
  END IF;
END $$;

-- Passo 5: Criar nova constraint única se não existir
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

-- Passo 6: Criar índices
CREATE INDEX IF NOT EXISTS idx_cooldown_location ON notification_cooldown(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cooldown_timestamp ON notification_cooldown(last_notification_at);
CREATE INDEX IF NOT EXISTS idx_cooldown_user ON notification_cooldown(user_id);

-- Passo 7: Atualizar comentários
COMMENT ON TABLE notification_cooldown IS 'Controla cooldown de 1 hora para notificações por usuário e região';
COMMENT ON COLUMN notification_cooldown.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN notification_cooldown.latitude IS 'Latitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.longitude IS 'Longitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.last_notification_at IS 'Timestamp da última notificação enviada para este usuário nesta região';
COMMENT ON COLUMN notification_cooldown.intensity_level IS 'Nível de intensidade da última notificação (light, moderate, heavy, extreme)';

-- Verificar estrutura final
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;

-- Mostrar constraints
SELECT 
  constraint_name, 
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'notification_cooldown';

-- Sucesso!
SELECT '✅ Migração concluída com sucesso!' as status;
