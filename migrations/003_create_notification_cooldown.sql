-- Tabela para controlar cooldown de notificações por região
-- Evita spam de notificações para a mesma localização

CREATE TABLE IF NOT EXISTS notification_cooldown (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
  intensity_level VARCHAR(20) NOT NULL,
  precipitation DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Índice único para garantir uma entrada por localização
  UNIQUE(latitude, longitude)
);

-- Índice para buscar por localização rapidamente
CREATE INDEX IF NOT EXISTS idx_cooldown_location ON notification_cooldown(latitude, longitude);

-- Índice para buscar por timestamp (para limpeza de registros antigos)
CREATE INDEX IF NOT EXISTS idx_cooldown_timestamp ON notification_cooldown(last_notification_at);

-- Comentários
COMMENT ON TABLE notification_cooldown IS 'Controla cooldown de 1 hora para notificações por região';
COMMENT ON COLUMN notification_cooldown.latitude IS 'Latitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.longitude IS 'Longitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN notification_cooldown.last_notification_at IS 'Timestamp da última notificação enviada para esta região';
COMMENT ON COLUMN notification_cooldown.intensity_level IS 'Nível de intensidade da última notificação (light, moderate, heavy, extreme)';
