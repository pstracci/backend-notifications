# Atualização do Sistema de Notificações de Chuva

## 📋 Resumo das Alterações

O sistema foi atualizado para **consultar previsões reais** da API do Tomorrow.io e enviar notificações baseadas em dados meteorológicos reais, substituindo o sistema anterior de notificações "fake".

---

## 🆕 Novos Recursos

### 1. **Integração com Tomorrow.io**
- Consulta a API do Tomorrow.io a cada 10 minutos
- Verifica precipitação prevista para os próximos 30 minutos
- API Key configurada: `vVizCi26cu5mljLrkFFvQxEg6V1OBNqF`

### 2. **Agrupamento Inteligente de Localizações**
- Arredonda latitude e longitude para **2 casas decimais**
- Agrupa usuários por "macro-regiões" para otimizar chamadas à API
- Reduz custos e melhora performance

### 3. **Notificações Diferenciadas por Intensidade**

#### 🌦️ **Chuva Fraca** (< 2.5 mm/h)
- Título: "Chuva Fraca se Aproximando"
- Vibração: Curta (200ms, pausa, 200ms)
- Prioridade: Normal

#### 🌧️ **Chuva Moderada** (2.5 - 10 mm/h)
- Título: "Chuva Moderada se Aproximando"
- Vibração: Média (3 pulsos)
- Prioridade: Alta

#### ⛈️ **Chuva Forte** (10 - 50 mm/h)
- Título: "CHUVA FORTE se Aproximando!"
- Vibração: Intensa (4 pulsos)
- Prioridade: Alta

#### 🚨 **Chuva Extrema** (> 50 mm/h)
- Título: "ALERTA: CHUVA EXTREMA!"
- Vibração: Muito Intensa (5 pulsos)
- Prioridade: Alta

### 4. **Padrões de Vibração Personalizados**
- Cada nível de intensidade tem um padrão único de vibração
- Configurado via Firebase Cloud Messaging (Android)
- Dados enviados também para iOS via APNS

---

## 📁 Arquivos Criados/Modificados

### **Novos Arquivos:**

1. **`weatherService.js`**
   - Consulta API do Tomorrow.io
   - Agrupa localizações únicas
   - Determina intensidade da chuva
   - Funções principais:
     - `checkRainForAllLocations(db)` - Verifica todas as localizações
     - `getWeatherForecast(lat, lon)` - Consulta previsão específica
     - `getRainIntensityLevel(precipitation)` - Classifica intensidade

2. **`notificationService.js`**
   - Gerencia envio de notificações
   - Configura padrões de vibração
   - Busca tokens de dispositivos
   - Funções principais:
     - `processRainForecasts(db, forecasts)` - Processa e envia notificações
     - `sendRainNotification(tokens, intensity, precipitation, location)` - Envia notificação
     - `getNotificationConfig(intensity, precipitation)` - Retorna configuração

### **Arquivos Modificados:**

1. **`package.json`**
   - Adicionado: `axios` para requisições HTTP

2. **`index.js`**
   - Importados novos serviços
   - Cron job alterado de 15 para **10 minutos**
   - Removida função `verificaClima()` fake
   - Adicionado endpoint `/api/check-rain-now` para testes manuais

---

## 🔄 Fluxo de Funcionamento

```
┌─────────────────────────────────────────────────────────────┐
│  CRON JOB (a cada 10 minutos)                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Buscar localizações únicas no banco (arredondadas)      │
│     SELECT ROUND(latitude, 2), ROUND(longitude, 2)          │
│     GROUP BY rounded_lat, rounded_lon                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Para cada localização única:                            │
│     - Consultar API Tomorrow.io                             │
│     - Analisar próximos 30 minutos                          │
│     - Determinar intensidade máxima                         │
│     - Delay de 500ms entre chamadas                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Filtrar localizações com chuva significativa:           │
│     - Intensidade > 0.1 mm/h                                │
│     - Probabilidade > 30%                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Para cada localização com chuva:                        │
│     - Buscar UIDs dos usuários                              │
│     - Buscar tokens dos dispositivos                        │
│     - Configurar notificação por intensidade                │
│     - Enviar via Firebase Cloud Messaging                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Como Testar

### **Teste Manual Imediato:**
```bash
# Fazer requisição POST para testar agora
curl -X POST http://localhost:3000/api/check-rain-now
```

### **Verificar Logs:**
O sistema exibe logs detalhados:
- Localizações encontradas
- Previsões consultadas
- Intensidades detectadas
- Notificações enviadas
- Sucessos e falhas

### **Teste de Notificação Genérica:**
```bash
# Endpoint existente para teste básico
curl -X POST http://localhost:3000/api/test-notification
```

---

## 📊 Estrutura do Banco de Dados

### **Tabela `users`:**
```sql
- uid (VARCHAR) - ID único do usuário
- latitude (DECIMAL) - Latitude da localização
- longitude (DECIMAL) - Longitude da localização
- location_updated_at (TIMESTAMP) - Última atualização
```

### **Tabela `devices`:**
```sql
- token (VARCHAR) - Token FCM do dispositivo
```

### **Query de Agrupamento:**
```sql
SELECT 
  ROUND(CAST(latitude AS numeric), 2) as rounded_lat,
  ROUND(CAST(longitude AS numeric), 2) as rounded_lon,
  array_agg(DISTINCT uid) as user_uids,
  COUNT(DISTINCT uid) as user_count
FROM users
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL
GROUP BY rounded_lat, rounded_lon
ORDER BY user_count DESC
```

---

## 🔧 Configurações da API Tomorrow.io

### **Endpoint:**
```
https://api.tomorrow.io/v4/timelines
```

### **Parâmetros:**
- `location`: `{latitude},{longitude}`
- `fields`: `precipitationIntensity`, `precipitationProbability`
- `timesteps`: `1m` (dados por minuto)
- `units`: `metric`
- `apikey`: `vVizCi26cu5mljLrkFFvQxEg6V1OBNqF`

### **Limites da API:**
- Delay de 500ms entre chamadas para evitar rate limiting
- Consulta apenas localizações únicas (otimizado)

---

## 📱 Configuração de Notificações no App

Para receber os padrões de vibração personalizados, o app Android deve:

1. **Criar canal de notificação:**
```javascript
// No app React Native/Expo
import * as Notifications from 'expo-notifications';

await Notifications.setNotificationChannelAsync('rain_alerts', {
  name: 'Alertas de Chuva',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  enableVibrate: true,
});
```

2. **Processar dados customizados:**
```javascript
// Listener de notificações
Notifications.addNotificationReceivedListener(notification => {
  const { data } = notification.request.content;
  
  if (data.type === 'rain_alert') {
    const vibrationPattern = JSON.parse(data.vibrationPattern);
    // Aplicar vibração customizada
    Vibration.vibrate(vibrationPattern);
  }
});
```

---

## 🎯 Critérios de Notificação

Uma notificação é enviada quando:
1. ✅ Precipitação prevista > 0.1 mm/h
2. ✅ Probabilidade > 30%
3. ✅ Evento nos próximos 30 minutos
4. ✅ Usuário tem dispositivo registrado

---

## 🚀 Próximos Passos Recomendados

1. **Monitoramento:**
   - Implementar logs em arquivo
   - Dashboard de estatísticas
   - Alertas de falhas na API

2. **Otimizações:**
   - Cache de previsões (evitar consultas duplicadas)
   - Batch processing mais eficiente
   - Retry logic para falhas

3. **Melhorias:**
   - Notificações de "fim da chuva"
   - Histórico de alertas por usuário
   - Preferências de notificação personalizadas

---

## ⚠️ Observações Importantes

- **API Key:** Proteja a chave da API em produção (use variáveis de ambiente)
- **Rate Limiting:** Tomorrow.io tem limites de requisições - monitore o uso
- **Precisão:** Previsões de curto prazo (30 min) são mais precisas
- **Custos:** Verifique o plano da API para garantir que suporta o volume de chamadas

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do servidor
2. Testar endpoint `/api/check-rain-now`
3. Validar tokens de dispositivos
4. Confirmar conectividade com Tomorrow.io API
