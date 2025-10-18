# 🔧 Solução Completa - Cooldown por Usuário

## 🎯 Problema Identificado

A tabela `devices` **não tinha relação com `users`**, impossibilitando o cooldown por usuário.

### Estrutura Antiga:
```
devices: id, token, created_at  ❌ SEM user_id
users: id, uid, email, ...
notification_cooldown: id, latitude, longitude, ...  ❌ SEM user_id
```

### Problema:
- Não era possível saber qual usuário era dono de cada device
- Cooldown era por região, bloqueando todos os usuários
- Endpoint `/register-device` não associava token ao usuário

## ✅ Solução Implementada

### 1. Banco de Dados

**Arquivo:** `migrations/COMPLETE_FIX.sql`

#### Mudanças na tabela `devices`:
```sql
-- Adicionar coluna user_id
ALTER TABLE devices ADD COLUMN user_id INTEGER;

-- Foreign key para users
ALTER TABLE devices ADD CONSTRAINT fk_device_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Constraint única (user_id, token)
ALTER TABLE devices ADD CONSTRAINT unique_user_token 
  UNIQUE(user_id, token);
```

#### Mudanças na tabela `notification_cooldown`:
```sql
-- Adicionar coluna user_id
ALTER TABLE notification_cooldown ADD COLUMN user_id INTEGER NOT NULL;

-- Foreign key para users
ALTER TABLE notification_cooldown ADD CONSTRAINT fk_cooldown_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Constraint única (user_id, latitude, longitude)
ALTER TABLE notification_cooldown ADD CONSTRAINT unique_user_location 
  UNIQUE(user_id, latitude, longitude);
```

### 2. Código Backend

#### Endpoint `/register-device` (index.js)

**Antes:**
```javascript
app.post('/register-device', async (req, res) => {
  const { token } = req.body;  // ❌ Só recebia token
  // ...
  INSERT INTO devices (token) VALUES ($1)
});
```

**Depois:**
```javascript
app.post('/register-device', async (req, res) => {
  const { token, uid } = req.body;  // ✅ Recebe token E uid
  // Busca user_id pelo uid
  // Associa token ao usuário
  INSERT INTO devices (token, user_id) VALUES ($1, $2)
});
```

#### Função `getDeviceTokensForUsers()` (notificationService.js)

**Corrigida para:**
```javascript
SELECT DISTINCT d.user_id, d.token
FROM devices d
INNER JOIN users u ON d.user_id = u.id  // ✅ JOIN correto
WHERE u.uid IN (...)
  AND d.token IS NOT NULL
  AND d.user_id IS NOT NULL
```

### 3. App Mobile (IMPORTANTE!)

O app precisa ser atualizado para enviar o `uid` ao registrar o token:

**Antes:**
```javascript
fetch('/register-device', {
  method: 'POST',
  body: JSON.stringify({ token })
});
```

**Depois:**
```javascript
fetch('/register-device', {
  method: 'POST',
  body: JSON.stringify({ 
    token,
    uid: currentUser.uid  // ✅ Adicionar uid
  })
});
```

## 🚀 Como Aplicar

### Passo 1: Executar SQL no Banco
```bash
# Via Docker
docker exec -i postgres-container psql -U user -d database < migrations/COMPLETE_FIX.sql

# Via psql
psql -h host -U user -d database -f migrations/COMPLETE_FIX.sql
```

### Passo 2: Deploy do Backend
```bash
git add .
git commit -m "Fix: Adicionar cooldown por usuário"
git push
docker-compose up -d --build
```

### Passo 3: Atualizar App Mobile
- Modificar chamada de `/register-device` para incluir `uid`
- Fazer novo build e deploy do app

### Passo 4: Limpar Devices Órfãos (Opcional)
```sql
-- Remover devices sem user_id (registros antigos)
DELETE FROM devices WHERE user_id IS NULL;
```

## 📊 Estrutura Final

### Tabela `devices`:
```
id          | SERIAL PRIMARY KEY
token       | TEXT NOT NULL
user_id     | INTEGER (FK -> users.id)  ✅ NOVO
created_at  | TIMESTAMP
UNIQUE(user_id, token)
```

### Tabela `notification_cooldown`:
```
id                      | SERIAL PRIMARY KEY
user_id                 | INTEGER NOT NULL (FK -> users.id)  ✅ NOVO
latitude                | DECIMAL(10, 7) NOT NULL
longitude               | DECIMAL(10, 7) NOT NULL
last_notification_at    | TIMESTAMP NOT NULL
intensity_level         | VARCHAR(20) NOT NULL
precipitation           | DECIMAL(10, 2) NOT NULL
created_at              | TIMESTAMP
UNIQUE(user_id, latitude, longitude)
```

## ✅ Verificação

### Backend Logs (Sucesso):
```
✅ Processamento concluído
📱 3 usuário(s) para notificar, 0 em cooldown
📝 Cooldown registrado para usuário 1 em -23.72, -46.55
📝 Cooldown registrado para usuário 2 em -23.72, -46.55
```

### Testar Manualmente:
```sql
-- Ver devices com usuários
SELECT d.id, d.token, u.email 
FROM devices d 
JOIN users u ON d.user_id = u.id;

-- Ver cooldowns por usuário
SELECT nc.*, u.email 
FROM notification_cooldown nc 
JOIN users u ON nc.user_id = u.id;
```

## ⚠️ Importante

1. **App mobile DEVE ser atualizado** para enviar `uid` no registro
2. **Devices antigos** sem `user_id` não receberão notificações
3. **Usuários precisam re-registrar** seus tokens após atualização

## 🎉 Resultado Final

**Antes:**
- Região A → 1 notificação/hora para TODOS

**Depois:**
- Região A → Usuário 1: 1 notificação/hora ✅
- Região A → Usuário 2: 1 notificação/hora ✅
- Região A → Usuário 3: 1 notificação/hora ✅

Cada usuário tem seu cooldown independente!
