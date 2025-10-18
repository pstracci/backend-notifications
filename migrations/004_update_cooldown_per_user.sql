-- Migration para alterar cooldown de região para nível de usuário
-- Permite que cada usuário receba notificações independentemente

-- 1. Remover a constraint única antiga (latitude, longitude)
ALTER TABLE notification_cooldown DROP CONSTRAINT IF EXISTS notification_cooldown_latitude_longitude_key;

-- 2. Adicionar coluna user_id
ALTER TABLE notification_cooldown ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 3. Adicionar foreign key para users
ALTER TABLE notification_cooldown 
  ADD CONSTRAINT fk_cooldown_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. Criar nova constraint única (user_id, latitude, longitude)
ALTER TABLE notification_cooldown 
  ADD CONSTRAINT unique_user_location 
  UNIQUE(user_id, latitude, longitude);

-- 5. Criar índice para buscar por usuário
CREATE INDEX IF NOT EXISTS idx_cooldown_user ON notification_cooldown(user_id);

-- 6. Atualizar comentários
COMMENT ON TABLE notification_cooldown IS 'Controla cooldown de 1 hora para notificações por usuário e região';
COMMENT ON COLUMN notification_cooldown.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN notification_cooldown.latitude IS 'Latitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.longitude IS 'Longitude da região (arredondada para 2 casas decimais)';
