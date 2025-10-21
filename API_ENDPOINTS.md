# API Endpoints - Backend de Notificações

## Autenticação

### POST `/api/auth/verify`
Verifica token Firebase e cria/retorna usuário no banco.
- **Body:** `{ token: string }`
- **Retorna:** Dados do usuário

---

## Dispositivos

### POST `/register-device`
Registra dispositivo FCM e cria usuário se não existir.
- **Body:** `{ token: string, uid: string, email?: string, name?: string, latitude?: number, longitude?: number }`
- **Retorna:** `{ userId, deviceId }`

---

## Localização

### POST `/api/background/location`
Atualiza localização do usuário em background (requer autenticação).
- **Body:** `{ latitude: number, longitude: number }`
- **Headers:** `Authorization: Bearer <token>`

### PUT `/api/users/location`
Atualiza localização manualmente (requer autenticação).
- **Body:** `{ latitude: number, longitude: number }`
- **Headers:** `Authorization: Bearer <token>`

---

## Notificações

### POST `/api/test-notification`
Envia notificação de teste para todos os dispositivos registrados.
- **Body:** (vazio)
- **Retorna:** Estatísticas de envio

### POST `/api/check-alerts-now`
Executa verificação manual de alertas meteorológicos.
- **Body:** (vazio)
- **Retorna:** Resumo dos alertas detectados

---

## Diagnóstico

### GET `/api/diagnose-user/:uid`
Diagnóstico completo de um usuário (dispositivos, cooldowns, localização).
- **Params:** `uid` (Firebase UID)
- **Retorna:** Dados completos do usuário + problemas detectados

### GET `/api/weather-status`
Status da API meteorológica.
- **Retorna:** Informações sobre a API Open-Meteo

---

## Manutenção (Testes)

### POST `/api/cleanup-cooldown-now`
Executa limpeza manual de cooldowns expirados.
- **Body:** (vazio)
- **Retorna:** `{ removed: number, remaining: number }`

---

## Base URL
`http://localhost:3000` (desenvolvimento)
