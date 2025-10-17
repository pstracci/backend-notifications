# 🕐 Sistema de Cooldown de Notificações

## 📋 Visão Geral

Sistema implementado para evitar spam de notificações, garantindo que cada região receba no máximo **1 notificação por hora**, mesmo que continue chovendo ou haja novas previsões.

## 🎯 Objetivos

1. **Evitar spam** de notificações para a mesma localização
2. **Remover automaticamente** tokens inválidos do banco de dados
3. **Melhorar experiência** do usuário (não bombardear com alertas)
4. **Otimizar uso** da API do Firebase (menos requisições)

## 🔧 Implementação

### **1. Tabela de Cooldown**

Nova tabela `notification_cooldown` criada no banco de dados:

```sql
CREATE TABLE notification_cooldown (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  last_notification_at TIMESTAMP NOT NULL DEFAULT NOW(),
  intensity_level VARCHAR(20) NOT NULL,
  precipitation DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(latitude, longitude)
);
```

**Campos:**
- `latitude/longitude`: Coordenadas da região (arredondadas para 2 casas decimais)
- `last_notification_at`: Timestamp da última notificação enviada
- `intensity_level`: Intensidade da última notificação (light, moderate, heavy, extreme)
- `precipitation`: Precipitação em mm/h da última notificação

### **2. Funções Implementadas**

#### **`isLocationInCooldown(db, latitude, longitude)`**
Verifica se uma localização recebeu notificação há menos de 1 hora.

```javascript
// Retorna true se está em cooldown, false caso contrário
const inCooldown = await isLocationInCooldown(db, -23.72, -46.55);
```

**Logs:**
```
⏳ Localização -23.72, -46.55 em cooldown (última notificação há 35 minutos)
```

#### **`recordNotificationSent(db, latitude, longitude, intensity, precipitation)`**
Registra que uma notificação foi enviada para uma localização.

```javascript
await recordNotificationSent(db, -23.72, -46.55, 'moderate', 5.0);
```

**Logs:**
```
📝 Cooldown registrado para -23.72, -46.55
```

#### **`removeInvalidTokens(db, invalidTokens)`**
Remove automaticamente tokens inválidos do banco de dados.

```javascript
await removeInvalidTokens(db, ['token_invalido_1', 'token_invalido_2']);
```

**Logs:**
```
🗑️ Removidos 2 token(s) inválido(s) do banco de dados
```

### **3. Fluxo de Processamento**

```
┌─────────────────────────────────────┐
│  Cron Job detecta chuva em região   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Verificar cooldown da região       │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   Em cooldown?   Não está
   (< 1 hora)     em cooldown
        │             │
        ▼             ▼
   ⏭️ Pular      ✅ Enviar
   região       notificação
                     │
                     ▼
              ┌──────────────┐
              │ Sucesso?     │
              └──────┬───────┘
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
          Sim (>0)       Não (0)
              │             │
              ▼             │
      📝 Registrar          │
      cooldown              │
              │             │
              └──────┬──────┘
                     │
                     ▼
              🗑️ Remover tokens
              inválidos (se houver)
```

## 📊 Exemplos de Logs

### **Cenário 1: Primeira notificação para região**
```
--- Processando localização: -23.72, -46.55 ---
Intensidade: moderate (5.2 mm/h)
Usuários afetados: 3
Enviando notificação de moderate para 5 dispositivo(s)...
✅ Notificações enviadas: 5 sucesso, 0 falhas
📝 Cooldown registrado para -23.72, -46.55
```

### **Cenário 2: Região em cooldown**
```
--- Processando localização: -23.72, -46.55 ---
Intensidade: moderate (5.8 mm/h)
Usuários afetados: 3
⏳ Localização -23.72, -46.55 em cooldown (última notificação há 25 minutos)
⏭️ Pulando localização (cooldown ativo)
```

### **Cenário 3: Tokens inválidos detectados**
```
--- Processando localização: -23.72, -46.55 ---
Intensidade: light (1.5 mm/h)
Usuários afetados: 2
Enviando notificação de light para 4 dispositivo(s)...
✅ Notificações enviadas: 2 sucesso, 2 falhas
Erro no token 3: messaging/registration-token-not-registered Requested entity was not found.
Erro no token 4: messaging/registration-token-not-registered Requested entity was not found.
🗑️ Removidos 2 token(s) inválido(s) do banco de dados
📝 Cooldown registrado para -23.72, -46.55
```

### **Cenário 4: Resumo com cooldown**
```
=== RESUMO DO PROCESSAMENTO ===
Localizações processadas: 5
Localizações puladas (cooldown): 2
Notificações enviadas com sucesso: 12
Falhas no envio: 0
```

## 🚀 Como Executar a Migration

### **Opção 1: Script Automático**
```bash
node run-migration.js
```

### **Opção 2: Manualmente no PostgreSQL**
```bash
psql -U seu_usuario -d seu_banco -f migrations/003_create_notification_cooldown.sql
```

### **Opção 3: Via código**
```javascript
const db = require('./db');
const fs = require('fs');

const sql = fs.readFileSync('./migrations/003_create_notification_cooldown.sql', 'utf8');
await db.query(sql);
```

## 🧪 Como Testar

### **Teste 1: Verificar Cooldown**
1. Envie uma notificação para uma região via painel admin
2. Aguarde alguns minutos
3. Tente enviar outra notificação para a mesma região
4. Verifique nos logs que foi pulada por cooldown

### **Teste 2: Tokens Inválidos**
1. Insira um token inválido manualmente no banco:
   ```sql
   INSERT INTO devices (token) VALUES ('token_invalido_teste');
   ```
2. Aguarde o cron job executar
3. Verifique nos logs que o token foi removido automaticamente

### **Teste 3: Cooldown Expirado**
1. Envie uma notificação para uma região
2. Aguarde 1 hora
3. Envie outra notificação para a mesma região
4. Verifique que a notificação foi enviada normalmente

## 📈 Consultas Úteis

### **Ver todas as regiões em cooldown**
```sql
SELECT 
  latitude,
  longitude,
  intensity_level,
  precipitation,
  last_notification_at,
  NOW() - last_notification_at AS time_since_last,
  EXTRACT(EPOCH FROM (NOW() - last_notification_at)) / 60 AS minutes_ago
FROM notification_cooldown
WHERE last_notification_at > NOW() - INTERVAL '1 hour'
ORDER BY last_notification_at DESC;
```

### **Limpar cooldowns antigos (> 24 horas)**
```sql
DELETE FROM notification_cooldown
WHERE last_notification_at < NOW() - INTERVAL '24 hours';
```

### **Ver estatísticas de cooldown**
```sql
SELECT 
  COUNT(*) AS total_regioes,
  COUNT(CASE WHEN last_notification_at > NOW() - INTERVAL '1 hour' THEN 1 END) AS em_cooldown,
  COUNT(CASE WHEN last_notification_at <= NOW() - INTERVAL '1 hour' THEN 1 END) AS disponiveis
FROM notification_cooldown;
```

### **Ver tokens inválidos (antes da limpeza)**
```sql
-- Esta query não funciona mais pois tokens inválidos são removidos automaticamente
-- Mas você pode verificar o histórico nos logs do servidor
```

## ⚙️ Configurações

### **Alterar Tempo de Cooldown**

Para mudar de 1 hora para outro valor, edite em `notificationService.js`:

```javascript
// Cooldown de 30 minutos
AND last_notification_at > NOW() - INTERVAL '30 minutes'

// Cooldown de 2 horas
AND last_notification_at > NOW() - INTERVAL '2 hours'

// Cooldown de 15 minutos
AND last_notification_at > NOW() - INTERVAL '15 minutes'
```

### **Desabilitar Cooldown (Não Recomendado)**

Comente a verificação em `notificationService.js`:

```javascript
// const inCooldown = await isLocationInCooldown(db, forecast.latitude, forecast.longitude);
// if (inCooldown) {
//   console.log('⏭️ Pulando localização (cooldown ativo)');
//   skippedDueToCooldown++;
//   continue;
// }
```

## 🔒 Tipos de Erros de Token Removidos

O sistema remove automaticamente tokens com os seguintes erros:

1. **`messaging/registration-token-not-registered`**
   - Token não está mais registrado no Firebase
   - Usuário desinstalou o app ou limpou dados

2. **`messaging/invalid-registration-token`**
   - Token está malformado ou inválido
   - Erro na geração do token

3. **`messaging/invalid-argument`**
   - Argumentos inválidos na mensagem
   - Geralmente relacionado a configurações incorretas

## 📊 Benefícios

### **Para o Usuário:**
- ✅ Não recebe spam de notificações
- ✅ Experiência mais agradável
- ✅ Notificações apenas quando necessário

### **Para o Sistema:**
- ✅ Menos requisições ao Firebase
- ✅ Banco de dados limpo (sem tokens inválidos)
- ✅ Logs mais organizados
- ✅ Melhor performance

### **Para a API:**
- ✅ Menos consumo de quota do Firebase
- ✅ Menos requisições à API Tomorrow.io
- ✅ Otimização de recursos

## 🎯 Próximas Melhorias (Opcional)

- [ ] Dashboard para visualizar regiões em cooldown
- [ ] Configuração de cooldown por intensidade (ex: extrema = 30min, leve = 2h)
- [ ] Histórico de notificações enviadas
- [ ] Estatísticas de taxa de entrega por região
- [ ] Limpeza automática de cooldowns antigos (cron job)
- [ ] Notificação quando cooldown expirar (se ainda estiver chovendo)

---

**Sistema de Cooldown implementado com sucesso!** 🎉
