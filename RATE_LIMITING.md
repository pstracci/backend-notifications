# Sistema de Rate Limiting - Tomorrow.io API

## 🎯 Limites da API Tomorrow.io

O plano gratuito/básico da API Tomorrow.io possui os seguintes limites:

- **500 requisições por dia**
- **25 requisições por hora**
- **3 requisições por segundo**

## ✅ Implementação

### **Arquivo: `rateLimiter.js`**

Sistema singleton que controla e monitora todas as requisições à API Tomorrow.io.

#### **Funcionalidades:**

1. **Controle de Limites**
   - Rastreia requisições por segundo, hora e dia
   - Bloqueia requisições quando limites são atingidos
   - Aguarda automaticamente até que seja possível fazer nova requisição

2. **Limpeza Automática**
   - Remove requisições antigas dos contadores
   - Mantém apenas requisições relevantes para cada período

3. **Cálculo Inteligente**
   - Determina quantas requisições podem ser feitas
   - Calcula delay ideal entre requisições
   - Distribui requisições ao longo do tempo

### **Integração no `weatherService.js`**

Todas as chamadas à API passam pelo rate limiter:

```javascript
// Antes de cada requisição
const check = rateLimiter.canMakeRequest();
if (!check.allowed) {
  // Aguarda até que seja possível fazer a requisição
  await rateLimiter.waitUntilAllowed();
}

// Registra a requisição
rateLimiter.recordRequest();

// Faz a chamada à API
const response = await axios.get(TOMORROW_API_URL, { params });
```

## 📊 Monitoramento

### **Endpoint: GET `/api/rate-limit-status`**

Retorna o status atual do rate limiter:

```bash
curl http://localhost:3000/api/rate-limit-status
```

**Resposta:**
```json
{
  "success": true,
  "limits": {
    "perSecond": { "max": 3, "description": "3 requisições por segundo" },
    "perHour": { "max": 25, "description": "25 requisições por hora" },
    "perDay": { "max": 500, "description": "500 requisições por dia" }
  },
  "current": {
    "perSecond": {
      "current": 0,
      "limit": 3,
      "available": 3,
      "percentage": "0.0"
    },
    "perHour": {
      "current": 5,
      "limit": 25,
      "available": 20,
      "percentage": "20.0"
    },
    "perDay": {
      "current": 48,
      "limit": 500,
      "available": 452,
      "percentage": "9.6"
    }
  },
  "warnings": []
}
```

### **Logs Automáticos**

O sistema exibe logs detalhados durante a verificação:

```
📊 Status do Rate Limiter:
   Por segundo: 0/3 (0.0%)
   Por hora: 5/25 (20.0%)
   Por dia: 48/500 (9.6%)

⏱️ Delay calculado entre requisições: 334ms

[1/15] Processando -23.55, -46.63 (12 usuários)
   ✅ Sem chuva significativa
[2/15] Processando -22.91, -43.21 (8 usuários)
   ⚠️ Chuva detectada: moderate (5.2 mm/h)

✅ Processamento concluído: 15/15 localizações verificadas
   Localizações com chuva: 3

📊 Status Final do Rate Limiter:
   Por hora: 20/25 (80.0%)
   Por dia: 63/500 (12.6%)
```

## 🔒 Proteções Implementadas

### **1. Verificação Prévia**
Antes de iniciar o processamento, verifica se há requisições disponíveis:

```javascript
const maxAllowed = rateLimiter.getMaxAllowedRequests();
if (maxAllowed === 0) {
  console.error('❌ Limite de requisições atingido');
  return [];
}
```

### **2. Limitação de Localizações**
Se houver mais localizações do que requisições disponíveis:

```javascript
if (locations.length > maxAllowed) {
  console.warn(`⚠️ Processando apenas as ${maxAllowed} primeiras localizações`);
}
```

As localizações são ordenadas por número de usuários, priorizando as mais importantes.

### **3. Delay Inteligente**
Calcula o delay ideal entre requisições:

- **Mínimo:** 334ms (garante máximo de 3 req/segundo)
- **Distribuído:** Se muitas localizações, distribui ao longo de 1 hora

```javascript
const optimalDelay = rateLimiter.calculateOptimalDelay(locationsToProcess);
// Resultado: 334ms a 3600000ms
```

### **4. Espera Automática**
Se um limite for atingido durante o processamento:

```javascript
if (!check.allowed) {
  console.warn(`⚠️ Rate limit atingido: ${check.reason}`);
  console.warn(`   Aguardando ${Math.ceil(check.waitTime / 1000)}s...`);
  await rateLimiter.waitUntilAllowed(check.waitTime + 1000);
}
```

## 📈 Cálculos de Capacidade

### **Cron Job a cada 10 minutos:**

- **Execuções por hora:** 6
- **Execuções por dia:** 144

### **Requisições por execução (máximo):**

- **Por hora:** 25 / 6 = ~4 localizações por execução
- **Por dia:** 500 / 144 = ~3 localizações por execução

### **Recomendações:**

1. **Até 3 localizações únicas:** ✅ Seguro para cron de 10 minutos
2. **4-25 localizações:** ⚠️ Pode atingir limite por hora
3. **Mais de 25 localizações:** ❌ Necessário aumentar intervalo do cron

## 🔧 Ajustes Recomendados

### **Se você tem muitas localizações:**

#### **Opção 1: Aumentar intervalo do cron**
```javascript
// De 10 para 15 minutos
cron.schedule('*/15 * * * *', async () => {
  // ...
});
```

**Capacidade:** 500 / 96 = ~5 localizações por execução

#### **Opção 2: Aumentar arredondamento**
```javascript
// De 2 para 1 casa decimal
function roundCoordinate(coord) {
  return Math.round(coord * 10) / 10; // Agrupa área maior
}
```

**Resultado:** Menos localizações únicas, mais usuários por localização

#### **Opção 3: Cache de previsões**
Implementar cache para reutilizar previsões de localizações próximas:

```javascript
// Exemplo: cache de 5 minutos
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

## ⚠️ Alertas e Avisos

### **Avisos no Console:**

- **90% do limite diário:** `⚠️ Limite diário quase atingido!`
- **90% do limite por hora:** `⚠️ Limite por hora quase atingido!`
- **Mais localizações que requisições:** `⚠️ Processando apenas as X primeiras`

### **Erros Críticos:**

- **Limite atingido:** `❌ Limite de requisições da API atingido`
- **Timeout de espera:** `❌ Não foi possível fazer requisição devido ao rate limit`

## 🧪 Testes

### **1. Verificar Status Atual:**
```bash
curl http://localhost:3000/api/rate-limit-status
```

### **2. Teste Manual de Verificação:**
```bash
curl -X POST http://localhost:3000/api/check-rain-now
```

### **3. Monitorar Logs:**
Observe os logs do servidor para ver:
- Quantas localizações estão sendo processadas
- Delay entre requisições
- Status do rate limiter antes e depois

## 📊 Exemplo de Uso Real

### **Cenário: 10 localizações únicas**

```
Verificando previsão para 10 localizações...

📊 Status do Rate Limiter:
   Por segundo: 0/3 (0.0%)
   Por hora: 2/25 (8.0%)
   Por dia: 45/500 (9.0%)

⏱️ Delay calculado entre requisições: 334ms

[1/10] Processando -23.55, -46.63 (25 usuários)
Consultando previsão para: -23.55, -46.63
   ✅ Sem chuva significativa

[2/10] Processando -22.91, -43.21 (18 usuários)
Consultando previsão para: -22.91, -43.21
   ⚠️ Chuva detectada: moderate (6.3 mm/h)

... (continua para todas as 10 localizações)

✅ Processamento concluído: 10/10 localizações verificadas
   Localizações com chuva: 2

📊 Status Final do Rate Limiter:
   Por hora: 12/25 (48.0%)
   Por dia: 55/500 (11.0%)
```

**Tempo total:** ~3.3 segundos (10 localizações × 334ms)

## 🎯 Conclusão

O sistema está **totalmente protegido** contra ultrapassar os limites da API Tomorrow.io:

✅ Controle rigoroso de requisições por segundo, hora e dia
✅ Espera automática quando limites são atingidos
✅ Priorização de localizações por número de usuários
✅ Logs detalhados para monitoramento
✅ Endpoint de status em tempo real
✅ Cálculo inteligente de delays

**O sistema nunca ultrapassará os limites da API.**
