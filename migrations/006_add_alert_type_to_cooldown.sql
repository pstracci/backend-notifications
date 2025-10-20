-- ============================================
-- Migration 006: Adicionar alert_type ao cooldown
-- ============================================
-- Permite cooldown separado por tipo de alerta
-- Cada usuário pode ter cooldowns independentes para diferentes tipos de alertas

-- 1. Adicionar coluna alert_type
ALTER TABLE notification_cooldown ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50);

-- 2. Atualizar registros existentes com valor padrão
UPDATE notification_cooldown 
SET alert_type = 'rain_now' 
WHERE alert_type IS NULL;

-- 3. Tornar coluna NOT NULL
ALTER TABLE notification_cooldown ALTER COLUMN alert_type SET NOT NULL;

-- 4. Remover constraint antiga unique_user_location
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_location'
    AND table_name = 'notification_cooldown'
  ) THEN
    ALTER TABLE notification_cooldown DROP CONSTRAINT unique_user_location;
    RAISE NOTICE 'Constraint unique_user_location removida';
  END IF;
END $$;

-- 5. Criar nova constraint única incluindo alert_type
ALTER TABLE notification_cooldown 
  ADD CONSTRAINT unique_user_location_alert 
  UNIQUE(user_id, latitude, longitude, alert_type);

-- 6. Criar índice para buscar por tipo de alerta
CREATE INDEX IF NOT EXISTS idx_cooldown_alert_type ON notification_cooldown(alert_type);

-- 7. Remover colunas antigas específicas de chuva (se existirem)
ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS intensity_level;
ALTER TABLE notification_cooldown DROP COLUMN IF EXISTS precipitation;

-- 8. Atualizar comentários
COMMENT ON TABLE notification_cooldown IS 'Controla cooldown de 1 hora para notificações por usuário, região e tipo de alerta';
COMMENT ON COLUMN notification_cooldown.alert_type IS 'Tipo do alerta (rain_now, air_quality, wind, uv_high, temperature)';
COMMENT ON COLUMN notification_cooldown.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN notification_cooldown.latitude IS 'Latitude da região';
COMMENT ON COLUMN notification_cooldown.longitude IS 'Longitude da região';
COMMENT ON COLUMN notification_cooldown.last_notification_at IS 'Timestamp da última notificação enviada';

-- Verificação
SELECT '✅ Migration 006 concluída com sucesso!' as status;
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;
