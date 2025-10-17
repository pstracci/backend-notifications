# 🌧️ Painel Admin - Notificações de Chuva

## 📋 Visão Geral

Painel administrativo moderno e intuitivo para testar notificações de chuva com diferentes intensidades.

## ✨ Funcionalidades

### **1. Dashboard com Estatísticas**
- 👥 **Total de Usuários Cadastrados**
- 📱 **Dispositivos Ativos**
- 🔔 **Notificações Enviadas** (contador em tempo real)

### **2. Seleção de Usuários**
- Lista completa de usuários cadastrados
- Informações: email, UID, data de cadastro
- Interface visual com destaque ao selecionar
- Animações suaves ao passar o mouse

### **3. Seleção de Intensidade de Chuva**

Quatro níveis de intensidade com configurações específicas:

#### **🌦️ Leve (Light)**
- **Faixa:** 0.5 - 2.5 mm/h
- **Prioridade:** Normal
- **Vibração:** Curta (200ms, pausa 100ms, 200ms)
- **Título:** "Chuva Fraca se Aproximando"
- **Mensagem:** "Chuva leve prevista nos próximos 30 minutos. Leve um guarda-chuva!"

#### **🌧️ Moderada (Moderate)**
- **Faixa:** 2.5 - 10 mm/h
- **Prioridade:** Alta
- **Vibração:** Média (300ms, pausa 150ms, repetido)
- **Título:** "Chuva Moderada se Aproximando"
- **Mensagem:** "Chuva moderada prevista nos próximos 30 minutos. Prepare-se!"

#### **⛈️ Forte (Heavy)**
- **Faixa:** 10 - 50 mm/h
- **Prioridade:** Alta
- **Vibração:** Intensa (400ms, pausa 200ms, repetido)
- **Título:** "CHUVA FORTE se Aproximando!"
- **Mensagem:** "ATENÇÃO: Chuva forte prevista nos próximos 30 minutos. Busque abrigo!"

#### **🚨 Extrema (Extreme)**
- **Faixa:** > 50 mm/h
- **Prioridade:** Alta
- **Vibração:** Muito intensa (500ms, pausa 250ms, repetido)
- **Título:** "ALERTA: CHUVA EXTREMA!"
- **Mensagem:** "ALERTA MÁXIMO: Chuva extrema prevista nos próximos 30 minutos. BUSQUE ABRIGO IMEDIATAMENTE!"

### **4. Preview em Tempo Real**

Visualização instantânea de como a notificação aparecerá no dispositivo:
- Ícone dinâmico baseado na intensidade
- Título e mensagem atualizados automaticamente
- Design similar ao de uma notificação real

### **5. Personalização de Mensagens**

Opção de personalizar título e mensagem:
- ✏️ Toggle "Personalizar mensagem"
- Campos de título e mensagem customizados
- Preview atualizado em tempo real conforme você digita
- Mantém configurações de intensidade (prioridade, vibração)

### **6. Feedback Visual**

- ✅ Alertas de sucesso com contador de dispositivos
- ❌ Alertas de erro com mensagem detalhada
- ⚠️ Avisos de validação
- 🚀 Indicador de carregamento durante envio
- Auto-dismiss de alertas após 5 segundos

## 🎨 Design

### **Características Visuais:**
- **Gradiente moderno:** Roxo/azul no fundo
- **Cards com sombra:** Efeito de profundidade
- **Animações suaves:** Hover, seleção, transições
- **Responsivo:** Funciona em desktop e mobile
- **Cores por intensidade:** Visual claro de cada nível

### **Paleta de Cores:**
- **Leve:** Cinza (`#6c757d`)
- **Moderada:** Azul (`#0d6efd`)
- **Forte:** Laranja (`#fd7e14`)
- **Extrema:** Vermelho (`#dc3545`)

## 🚀 Como Usar

### **Acesso:**
```
http://localhost:3000/admin.html
```

### **Fluxo de Uso:**

1. **Selecione um usuário** da lista
   - Clique no card do usuário desejado
   - O formulário de notificação aparecerá

2. **Escolha a intensidade** da chuva
   - Clique em um dos 4 botões de intensidade
   - Veja o preview atualizar automaticamente

3. **(Opcional) Personalize a mensagem**
   - Ative o toggle "Personalizar mensagem"
   - Digite título e mensagem customizados
   - Preview mostrará suas alterações

4. **Envie a notificação**
   - Clique em "🚀 Enviar Notificação de Teste"
   - Aguarde confirmação
   - Verifique no dispositivo

## 📱 Estrutura da Notificação

### **Dados Enviados:**
```json
{
  "notification": {
    "title": "Título da notificação",
    "body": "Mensagem da notificação"
  },
  "data": {
    "type": "rain_alert",
    "intensity": "moderate",
    "precipitation": "5.0",
    "timestamp": "2025-01-17T22:50:00.000Z",
    "source": "admin_test"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "rain_alerts",
      "defaultSound": true,
      "vibrateTimingsMillis": [300, 150, 300, 150, 300]
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "default",
        "badge": 1
      }
    }
  }
}
```

## 🔧 Endpoints Utilizados

### **GET `/api/admin/users`**
Retorna lista de todos os usuários cadastrados.

**Resposta:**
```json
[
  {
    "id": 1,
    "uid": "firebase_uid_123",
    "email": "usuario@example.com",
    "created_at": "2025-01-15T10:30:00.000Z"
  }
]
```

### **POST `/api/admin/send-notification`**
Envia notificação de teste para um usuário.

**Corpo da Requisição:**
```json
{
  "userId": 1,
  "title": "Título da notificação",
  "message": "Mensagem da notificação",
  "intensity": "moderate",
  "precipitation": 5.0
}
```

**Resposta:**
```json
{
  "success": true,
  "sent": 3,
  "failed": 0,
  "total": 3,
  "results": [
    { "success": true, "messageId": "..." },
    { "success": true, "messageId": "..." },
    { "success": true, "messageId": "..." }
  ]
}
```

## 🧪 Casos de Teste Recomendados

### **Teste 1: Chuva Leve**
- Selecione intensidade "Leve"
- Envie notificação
- Verifique: vibração curta, prioridade normal

### **Teste 2: Chuva Extrema**
- Selecione intensidade "Extrema"
- Envie notificação
- Verifique: vibração intensa, alerta urgente

### **Teste 3: Mensagem Personalizada**
- Ative "Personalizar mensagem"
- Digite título: "Teste Customizado"
- Digite mensagem: "Esta é uma mensagem de teste"
- Envie e verifique no dispositivo

### **Teste 4: Múltiplos Usuários**
- Selecione usuário 1, envie notificação
- Selecione usuário 2, envie notificação
- Verifique contador de notificações enviadas

## 📊 Logs do Servidor

Ao enviar uma notificação, o servidor exibe:

```
=== ENVIANDO NOTIFICAÇÃO DE TESTE ===
Usuário ID: 1
Intensidade: moderate
Título: Chuva Moderada se Aproximando
Mensagem: Chuva moderada prevista nos próximos 30 minutos (5.0 mm/h). Prepare-se!
📱 Enviando para 3 dispositivo(s)
✅ Mensagem 1/3 enviada com sucesso
✅ Mensagem 2/3 enviada com sucesso
✅ Mensagem 3/3 enviada com sucesso

📊 Resultado: 3 sucesso, 0 falhas
=====================================
```

## 🎯 Próximas Melhorias (Opcional)

- [ ] Filtrar usuários por localização
- [ ] Enviar para múltiplos usuários simultaneamente
- [ ] Histórico de notificações enviadas
- [ ] Agendamento de notificações
- [ ] Estatísticas de taxa de entrega
- [ ] Endpoint específico para contagem de dispositivos
- [ ] Autenticação/autorização para acesso ao painel

## 🔐 Segurança

**IMPORTANTE:** Este painel não possui autenticação. Em produção:

1. Adicione autenticação (Firebase Auth, JWT, etc.)
2. Restrinja acesso apenas a administradores
3. Implemente rate limiting
4. Adicione logs de auditoria
5. Valide todas as entradas do usuário

## 📝 Notas Técnicas

- **Framework Frontend:** Bootstrap 5.1.3
- **JavaScript:** Vanilla JS (sem dependências)
- **Backend:** Express.js + Firebase Admin SDK
- **Banco de Dados:** PostgreSQL
- **Notificações:** Firebase Cloud Messaging (FCM)

---

**Desenvolvido para facilitar testes de notificações de chuva** 🌧️
