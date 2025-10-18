# Guia de Migração - Cooldown por Usuário

## Problema Corrigido

O sistema de cooldown estava implementado **por região**, o que causava:
- ❌ Se um usuário recebia notificação, todos os outros na mesma região eram bloqueados
- ❌ Apenas 1 pessoa por região podia receber alarme a cada hora

## Solução Implementada

Agora o cooldown é **por usuário + região**:
- ✅ Cada usuário tem seu próprio cooldown independente
- ✅ Múltiplos usuários na mesma região podem receber notificações
- ✅ Cooldown de 1 hora é individual por usuário

## Como Aplicar a Correção

### Opção 1: Script Automático (Recomendado)

```bash
npm run setup-cooldown
```

Este script:
1. Verifica se a tabela `notification_cooldown` existe
2. Cria a tabela se não existir
3. Adiciona a coluna `user_id` se necessário
4. Atualiza as constraints para cooldown por usuário
5. Mostra a estrutura final da tabela

### Opção 2: Verificar Status Primeiro

```bash
npm run check-db
```

Este comando mostra:
- Se a tabela existe
- Quais colunas estão presentes
- Se a estrutura está atualizada

### Opção 3: Executar Migrations Manualmente

```bash
# Se a tabela não existe
node run-migration.js

# Se a tabela existe mas não tem user_id
node run-migration-004.js
```

## Estrutura Final da Tabela

```sql
notification_cooldown (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,              -- NOVO: ID do usuário
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL,
  intensity_level VARCHAR(20) NOT NULL,
  precipitation DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, latitude, longitude),  -- ALTERADO: agora inclui user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

## Mudanças no Código

### Funções Atualizadas

1. **`isUserLocationInCooldown(db, userId, latitude, longitude)`**
   - Antes: `isLocationInCooldown(db, latitude, longitude)`
   - Agora verifica cooldown por usuário

2. **`recordNotificationSent(db, userId, latitude, longitude, ...)`**
   - Antes: `recordNotificationSent(db, latitude, longitude, ...)`
   - Agora registra cooldown por usuário

3. **`getDeviceTokensForUsers(db, userUids)`**
   - Retorna: `[{userId, token}, ...]`
   - Antes retornava apenas: `[token, ...]`

4. **`processRainForecasts(db, forecasts)`**
   - Verifica cooldown individualmente para cada usuário
   - Envia notificações apenas para usuários sem cooldown
   - Registra cooldown por usuário após envio bem-sucedido

## Testando

Após aplicar a migração:

1. Reinicie o servidor
2. Aguarde uma previsão de chuva
3. Verifique os logs - deve mostrar:
   ```
   📱 X usuário(s) para notificar, Y em cooldown
   ```

## Rollback (se necessário)

Se precisar reverter:

```sql
-- Remover coluna user_id
ALTER TABLE notification_cooldown DROP COLUMN user_id;

-- Restaurar constraint antiga
ALTER TABLE notification_cooldown 
  ADD CONSTRAINT notification_cooldown_latitude_longitude_key 
  UNIQUE(latitude, longitude);
```

**Nota**: Após rollback, você também precisará reverter o código para a versão anterior.
