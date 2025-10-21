-- ============================================
-- Migration 007: Adicionar severity e alert_value ao cooldown
-- ============================================
-- Adiciona colunas para armazenar a severidade e valor do alerta
-- que gerou a notificação

-- 1. Adicionar coluna severity (severidade do alerta)
ALTER TABLE notification_cooldown 
ADD COLUMN IF NOT EXISTS severity VARCHAR(50);

-- 2. Adicionar coluna alert_value (valor numérico do alerta)
ALTER TABLE notification_cooldown 
ADD COLUMN IF NOT EXISTS alert_value DECIMAL(10, 2);

-- 3. Criar índice para buscar por severidade
CREATE INDEX IF NOT EXISTS idx_cooldown_severity 
ON notification_cooldown(severity);

-- 4. Atualizar comentários
COMMENT ON COLUMN notification_cooldown.severity IS 'Severidade do alerta (light, moderate, heavy, extreme, etc)';
COMMENT ON COLUMN notification_cooldown.alert_value IS 'Valor numérico do alerta (ex: mm de chuva, índice UV, AQI, km/h de vento)';

-- Verificação
SELECT '✅ Migration 007 concluída com sucesso!' as status;

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;
