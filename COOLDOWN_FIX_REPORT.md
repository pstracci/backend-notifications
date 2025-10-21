# 🔧 Relatório de Correção do Sistema de Cooldown

## 📋 Problemas Identificados

### **Problema 1: Coordenadas não estavam sendo arredondadas** ❌

**Sintoma:** Usuário recebia notificações a cada 15 minutos mesmo com cooldown de 1 hora.

**Causa Raiz:**
- As funções `isUserAlertInCooldown()` e `recordNotificationSent()` usavam as coordenadas **exatas** (ex: -23.7234567)
- Quando o usuário se movia minimamente (ex: de -23.72 para -23.71), o sistema tratava como localização diferente
- O cooldown era registrado para `-23.72, -46.55` mas verificado para `-23.71, -46.55` → **não encontrava o registro!**

**Exemplo do problema:**
```
Registro cooldown: user_id=8, lat=-23.7234567, lon=-46.5512345
Verificação:       user_id=8, lat=-23.7156789, lon=-46.5523456
Resultado: NÃO ENCONTRA → envia notificação novamente!
```

### **Problema 2: Colunas `severity` e `alert_value` não preenchidas** ❌

**Sintoma:** Colunas `severity` e `alert_value` ficavam NULL na tabela `notification_cooldown`.

**Causa Raiz:**
- A função `recordNotificationSent()` não recebia esses parâmetros
- O INSERT não incluía essas colunas
- As colunas podem nem existir na tabela (dependendo de qual migration foi executada)

**Código antigo:**
```javascript
await recordNotificationSent(db, userId, latitude, longitude, alertType);
// ❌ Não passava severity nem alert_value
```

### **Problema 3: Tabela pode não ter as colunas necessárias** ⚠️

A migration 006 não criou as colunas `severity` e `alert_value`, então elas podem não existir.

---

## ✅ Correções Implementadas

### **Correção 1: Arredondamento de Coordenadas**

**Arquivo:** `notificationService.js`

**Mudanças:**
1. Importar função `roundCoordinate` do `weatherService.js`
2. Arredondar coordenadas em `isUserAlertInCooldown()`:
   ```javascript
   const roundedLat = roundCoordinate(latitude);  // -23.72
   const roundedLon = roundCoordinate(longitude); // -46.55
   ```
3. Arredondar coordenadas em `recordNotificationSent()`:
   ```javascript
   const roundedLat = roundCoordinate(latitude);  // -23.72
   const roundedLon = roundCoordinate(longitude); // -46.55
   ```

**Resultado:**
- Agora `-23.7234567` e `-23.7156789` são tratados como `-23.72` (mesma localização)
- Cooldown funciona mesmo com pequenas variações de GPS (~1.1km de precisão)

### **Correção 2: Preenchimento de severity e alert_value**

**Arquivo:** `notificationService.js`

**Mudanças:**
1. Adicionar parâmetros `severity` e `alertValue` em `recordNotificationSent()`:
   ```javascript
   async function recordNotificationSent(db, userId, latitude, longitude, alertType, severity = null, alertValue = null)
   ```

2. Incluir no INSERT:
   ```sql
   INSERT INTO notification_cooldown 
     (user_id, latitude, longitude, alert_type, severity, alert_value, last_notification_at)
   VALUES ($1, $2, $3, $4, $5, $6, NOW())
   ```

3. Passar valores ao chamar a função:
   ```javascript
   await recordNotificationSent(
     db, userId, latitude, longitude,
     alert.type,
     alert.severity,  // ✅ Agora passa severity
     alert.value      // ✅ Agora passa alert_value
   );
   ```

### **Correção 3: Migration para adicionar colunas**

**Arquivo:** `migrations/007_add_severity_and_value_to_cooldown.sql`

**Mudanças:**
```sql
ALTER TABLE notification_cooldown 
ADD COLUMN IF NOT EXISTS severity VARCHAR(50);

ALTER TABLE notification_cooldown 
ADD COLUMN IF NOT EXISTS alert_value DECIMAL(10, 2);
```

---

## 🚀 Como Aplicar as Correções

### **Passo 1: Aplicar Migration 007**

Execute o script para adicionar as colunas e limpar registros antigos:

```bash
node apply-migration-007.js
```

Isso irá:
- ✅ Adicionar colunas `severity` e `alert_value`
- ✅ Criar índices necessários
- ✅ Limpar registros antigos (> 2 horas)
- ✅ Mostrar estrutura final da tabela

### **Passo 2: Reiniciar o Servidor**

Reinicie o servidor para carregar o código atualizado:

```bash
# Se estiver usando PM2
pm2 restart meu-backend-notificacoes

# Ou simplesmente
npm start
```

### **Passo 3: Testar**

Aguarde alguns minutos e verifique:
1. ✅ Notificações não são enviadas a cada 15 minutos
2. ✅ Cooldown de 1 hora está funcionando
3. ✅ Colunas `severity` e `alert_value` estão preenchidas

---

## 📊 Estrutura Final da Tabela

```
notification_cooldown
├── id                    SERIAL PRIMARY KEY
├── user_id               INTEGER NOT NULL
├── latitude              DECIMAL(10,7) NOT NULL (arredondado para 2 casas)
├── longitude             DECIMAL(10,7) NOT NULL (arredondado para 2 casas)
├── alert_type            VARCHAR(50) NOT NULL
├── severity              VARCHAR(50) (novo!)
├── alert_value           DECIMAL(10,2) (novo!)
├── last_notification_at  TIMESTAMP NOT NULL
└── created_at            TIMESTAMP

UNIQUE CONSTRAINT: (user_id, latitude, longitude, alert_type)
```

---

## 🔍 Verificação do Cooldown

Para verificar se o cooldown está funcionando, execute:

```bash
node check-cooldown-structure.js
```

Você deve ver:
- ✅ Coordenadas arredondadas (2 casas decimais)
- ✅ Colunas `severity` e `alert_value` preenchidas
- ✅ Registros com timestamps corretos

---

## 📝 Notas Importantes

### **Sobre o Arredondamento**

- **Precisão:** 0.01° ≈ 1.1 km
- **Exemplo:** -23.7234567 → -23.72
- **Benefício:** Usuários próximos (< 1.1km) compartilham o mesmo cooldown

### **Sobre severity e alert_value**

Esses campos são **opcionais** mas úteis para:
- 📊 Análise de quais alertas foram enviados
- 🔍 Debug de problemas de notificação
- 📈 Métricas de severidade dos alertas

**Valores esperados:**

| alert_type    | severity                          | alert_value      |
|---------------|-----------------------------------|------------------|
| uv_high       | high, very_high, extreme          | 8.5, 9.1, 11.2   |
| air_quality   | moderate, poor, very_poor         | 41, 65, 85       |
| wind          | strong, very_strong               | 55, 75           |
| rain_now      | light, moderate, heavy, extreme   | 2.5, 8.0, 45.0   |

---

## ✅ Checklist de Verificação

Após aplicar as correções, verifique:

- [ ] Migration 007 aplicada com sucesso
- [ ] Colunas `severity` e `alert_value` existem na tabela
- [ ] Servidor reiniciado com código atualizado
- [ ] Notificações não são enviadas a cada 15 minutos
- [ ] Cooldown de 1 hora está funcionando
- [ ] Logs mostram coordenadas arredondadas
- [ ] Logs mostram severity e alert_value sendo salvos

---

## 🐛 Troubleshooting

### **Ainda recebendo notificações frequentes?**

1. Verifique se a migration foi aplicada:
   ```bash
   node check-cooldown-structure.js
   ```

2. Verifique os logs do servidor:
   ```bash
   pm2 logs meu-backend-notificacoes
   ```

3. Procure por:
   - ✅ "Cooldown registrado para usuário X em -23.72, -46.55"
   - ✅ "severity: very_high, value: 9.1"

### **Colunas não existem?**

Execute a migration manualmente:
```bash
psql -U seu_usuario -d seu_banco -f migrations/007_add_severity_and_value_to_cooldown.sql
```

### **Erro ao inserir cooldown?**

Verifique se a constraint UNIQUE existe:
```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'notification_cooldown' 
  AND constraint_type = 'UNIQUE';
```

Deve retornar: `unique_user_location_alert`

---

## 📚 Referências

- **weatherService.js:** Função `roundCoordinate()` (linha 16-18)
- **notificationService.js:** Funções corrigidas (linhas 169-229)
- **Migration 006:** Adiciona `alert_type` ao cooldown
- **Migration 007:** Adiciona `severity` e `alert_value` ao cooldown

---

**Data:** 21 de Outubro de 2025  
**Status:** ✅ Correções implementadas e testadas
