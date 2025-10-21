-- ============================================
-- Migration 008: Corrigir nome da coluna severity
-- ============================================
-- A coluna "severity " tem um espaço extra no final do nome
-- Isso causa erro ao tentar inserir dados
-- Esta migration renomeia para "severity" (sem espaço)

-- 1. Renomear coluna "severity " para "severity"
ALTER TABLE notification_cooldown 
RENAME COLUMN "severity " TO severity;

-- 2. Recriar índice se necessário
DROP INDEX IF EXISTS idx_cooldown_severity;
CREATE INDEX idx_cooldown_severity ON notification_cooldown(severity);

-- Verificação
SELECT '✅ Migration 008 concluída com sucesso!' as status;
SELECT 'Coluna "severity " renomeada para "severity"' as message;

-- Mostrar estrutura atualizada
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
  AND column_name IN ('severity', 'alert_type', 'alert_value')
ORDER BY column_name;
