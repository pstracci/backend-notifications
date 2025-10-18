# 🔧 Correção do Painel Admin

## Problema Identificado

A tela de admin tinha dois problemas:

1. ❌ **Listagem**: Só mostrava 1 usuário (faltavam informações)
2. ❌ **Envio**: Enviava notificação para TODOS os dispositivos, não apenas do usuário selecionado

## Correções Aplicadas

### 1. Listagem de Usuários Melhorada

**Endpoint:** `GET /api/admin/users`

**Antes:**
```sql
SELECT id, uid, email, created_at FROM users
```

**Depois:**
```sql
SELECT 
  u.id, 
  u.uid, 
  u.email,
  u.name,
  u.latitude,
  u.longitude,
  u.created_at,
  u.location_updated_at,
  COUNT(d.id) as device_count  -- Mostra quantos dispositivos o usuário tem
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
GROUP BY u.id, ...
ORDER BY u.created_at DESC
```

**Agora retorna:**
- ✅ Todos os usuários cadastrados
- ✅ Nome e email de cada usuário
- ✅ Localização atual (latitude/longitude)
- ✅ Número de dispositivos registrados
- ✅ Data de criação e última atualização

### 2. Envio Individual de Notificações

**Endpoint:** `POST /api/admin/send-notification`

**Antes:**
```sql
-- ❌ Buscava TODOS os tokens
SELECT token FROM devices WHERE token IS NOT NULL
```

**Depois:**
```sql
-- ✅ Busca apenas tokens do usuário específico
SELECT d.token 
FROM devices d 
WHERE d.user_id = $1 
  AND d.token IS NOT NULL
```

**Agora:**
- ✅ Envia notificação apenas para o usuário selecionado
- ✅ Mostra no log qual usuário está recebendo
- ✅ Retorna erro se o usuário não tiver dispositivos

### 3. Novo Endpoint: Detalhes do Usuário

**Endpoint:** `GET /api/admin/users/:userId`

Retorna informações completas de um usuário:
```json
{
  "user": {
    "id": 1,
    "uid": "abc123",
    "email": "usuario@email.com",
    "name": "Nome do Usuário",
    "latitude": -23.72,
    "longitude": -46.55,
    "created_at": "2025-01-01T00:00:00Z",
    "location_updated_at": "2025-01-15T10:30:00Z"
  },
  "devices": [
    {
      "id": 1,
      "token": "fcm_token_123...",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "notifications": [
    {
      "latitude": -23.72,
      "longitude": -46.55,
      "intensity_level": "moderate",
      "precipitation": 5.5,
      "last_notification_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Como Testar

### 1. Listar Todos os Usuários
```bash
curl http://localhost:3000/api/admin/users
```

**Deve retornar:**
- Você
- Sua esposa
- Qualquer outro usuário cadastrado

### 2. Ver Detalhes de um Usuário
```bash
curl http://localhost:3000/api/admin/users/1
```

### 3. Enviar Notificação Individual
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Teste",
    "message": "Notificação de teste",
    "intensity": "moderate"
  }'
```

## Verificação

### Logs do Backend

**Antes (errado):**
```
📱 Enviando para 2 dispositivo(s)  ← Enviava para todos
```

**Depois (correto):**
```
📋 Listando 2 usuário(s)
📱 Enviando para 1 dispositivo(s) do usuário 1  ← Apenas para o selecionado
```

## Interface Admin (Frontend)

Se você tem uma interface web, ela deve:

1. **Mostrar lista de usuários** com:
   - Nome/Email
   - Número de dispositivos
   - Localização atual
   - Botão "Enviar Notificação"

2. **Formulário de envio** com:
   - Seleção de usuário (dropdown)
   - Título da notificação
   - Mensagem
   - Intensidade (light, moderate, heavy, extreme)
   - Botão "Enviar"

## Exemplo de Interface (HTML)

```html
<div class="admin-panel">
  <h2>Usuários Cadastrados</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Nome</th>
        <th>Email</th>
        <th>Dispositivos</th>
        <th>Localização</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody id="users-list">
      <!-- Preenchido via JavaScript -->
    </tbody>
  </table>
  
  <h2>Enviar Notificação</h2>
  <form id="notification-form">
    <select name="userId" required>
      <option value="">Selecione um usuário</option>
      <!-- Preenchido via JavaScript -->
    </select>
    <input type="text" name="title" placeholder="Título" required>
    <textarea name="message" placeholder="Mensagem" required></textarea>
    <select name="intensity">
      <option value="light">Leve</option>
      <option value="moderate">Moderada</option>
      <option value="heavy">Forte</option>
      <option value="extreme">Extrema</option>
    </select>
    <button type="submit">Enviar</button>
  </form>
</div>
```

## Próximos Passos

1. ✅ Backend atualizado (já feito)
2. ⚠️ Atualizar frontend (se houver) para usar os novos endpoints
3. ⚠️ Testar envio individual para cada usuário
4. ⚠️ Verificar que apenas o usuário selecionado recebe a notificação
