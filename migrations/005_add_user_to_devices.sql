-- Migration para adicionar relação entre devices e users
-- Necessário para implementar cooldown por usuário

-- Passo 1: Adicionar coluna user_id na tabela devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Passo 2: Adicionar foreign key
ALTER TABLE devices 
  ADD CONSTRAINT fk_device_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Passo 3: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Passo 4: Adicionar constraint única para evitar duplicatas de token por usuário
-- Nota: Removemos a constraint antiga de token único global primeiro
DO $$ 
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'devices_token_key'
    AND table_name = 'devices'
  ) THEN
    ALTER TABLE devices DROP CONSTRAINT devices_token_key;
    RAISE NOTICE 'Constraint devices_token_key removida';
  END IF;
  
  -- Adicionar nova constraint única (user_id, token)
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

-- Comentários
COMMENT ON COLUMN devices.user_id IS 'ID do usuário dono do dispositivo';

-- Verificar estrutura final
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'devices'
ORDER BY ordinal_position;
