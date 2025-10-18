# Diagnóstico de Problemas com Notificações

## Problema Identificado

Baseado no log de erro que você compartilhou:

```
Erro no token 1: messaging/invalid-argument The registration token is not a valid FCM registration token
Erro no token 2: messaging/invalid-argument The registration token is not a valid FCM registration token
🗑️ Removidos 2 token(s) inválido(s) do banco de dados
```

**O problema é que os tokens FCM armazenados no banco de dados são inválidos.**

## Possíveis Causas

1. **Token FCM não foi registrado corretamente pelo app**
   - O app mobile precisa chamar o endpoint `/register-device` com o token FCM válido
   - O token FCM é gerado pelo Firebase Cloud Messaging no dispositivo

2. **Token FCM expirou ou foi invalidado**
   - Tokens FCM podem expirar
   - Tokens são invalidados quando o app é desinstalado e reinstalado
   - Tokens são invalidados quando o usuário limpa os dados do app

3. **Token FCM foi removido automaticamente**
   - O backend remove automaticamente tokens inválidos do banco
   - Isso aconteceu no seu caso (2 tokens foram removidos)

## Como Diagnosticar

### 1. Verificar o estado do seu usuário no banco

Faça uma requisição GET para o endpoint de diagnóstico:

```bash
curl https://seu-backend.railway.app/api/diagnose-user/jt9h3DQIUfg5CqLW0oGKErBXY6u1
```

Ou acesse no navegador:
```
https://seu-backend.railway.app/api/diagnose-user/jt9h3DQIUfg5CqLW0oGKErBXY6u1
```

O endpoint retornará:
- ✅ Informações do usuário (ID, email, localização)
- ✅ Dispositivos registrados e seus tokens
- ✅ Histórico de cooldown
- ✅ Localizações próximas no banco
- ✅ Diagnóstico de problemas

### 2. Verificar se o app está registrando o token

No app mobile, verifique se:

1. O Firebase Cloud Messaging está configurado corretamente
2. O app está solicitando permissão para notificações
3. O app está obtendo o token FCM
4. O app está chamando `/register-device` com o token

**Exemplo de código no app (React Native/Expo):**

```javascript
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

async function registerForPushNotifications() {
  // 1. Solicitar permissão
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Permissão de notificação negada');
    return;
  }

  // 2. Obter token FCM
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig.extra.eas.projectId
  })).data;

  console.log('Token FCM:', token);

  // 3. Registrar no backend
  const response = await fetch('https://seu-backend.railway.app/register-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token,
      uid: 'jt9h3DQIUfg5CqLW0oGKErBXY6u1',
      email: 'seu-email@example.com',
      name: 'Seu Nome',
      latitude: -23.715096,
      longitude: -46.548631
    })
  });

  const result = await response.json();
  console.log('Registro:', result);
}
```

## Solução

### Passo 1: Verificar se há dispositivos registrados

Use o endpoint de diagnóstico para verificar se você tem dispositivos registrados:

```bash
curl https://seu-backend.railway.app/api/diagnose-user/jt9h3DQIUfg5CqLW0oGKErBXY6u1
```

Se a resposta mostrar `devices: []` ou `has_token: false`, o problema é que **não há token FCM válido registrado**.

### Passo 2: Registrar o token FCM novamente

No app mobile:

1. Abra o app
2. Certifique-se de que as permissões de notificação estão habilitadas
3. O app deve automaticamente:
   - Obter o token FCM
   - Chamar `/register-device`
   - Registrar o token no banco

### Passo 3: Testar notificação

Após registrar o token, teste se está funcionando:

```bash
curl -X POST https://seu-backend.railway.app/api/test-notification
```

Se o token estiver válido, você deve receber uma notificação de teste no dispositivo.

### Passo 4: Verificar cooldown

Se você recebeu uma notificação recentemente (nas últimas 1 hora), o sistema de cooldown pode estar bloqueando novas notificações para a mesma localização.

Use o endpoint de diagnóstico para verificar cooldowns ativos:

```bash
curl https://seu-backend.railway.app/api/diagnose-user/jt9h3DQIUfg5CqLW0oGKErBXY6u1
```

Procure por `cooldowns` na resposta. Se houver cooldowns com `is_active: true`, você não receberá notificações para aquela localização até que o cooldown expire.

## Checklist de Verificação

- [ ] Permissões de notificação habilitadas no dispositivo
- [ ] App tem configuração correta do Firebase Cloud Messaging
- [ ] App está obtendo o token FCM
- [ ] App está chamando `/register-device` com o token
- [ ] Token está registrado no banco (verificar com `/api/diagnose-user/:uid`)
- [ ] Token é válido (testar com `/api/test-notification`)
- [ ] Não há cooldown ativo para sua localização
- [ ] Há previsão de chuva para sua localização

## Logs Úteis

### Backend

O backend loga informações importantes:

```
=== REGISTRO DE DISPOSITIVO ===
UID: jt9h3DQIUfg5CqLW0oGKErBXY6u1
Token: abcd1234...
✅ Usuário encontrado com ID: 1
✅ Dispositivo registrado com ID: 1
```

### App Mobile

O app deve logar:

```
Token FCM obtido: abcd1234...
Registrando dispositivo no backend...
✅ Dispositivo registrado com sucesso
```

## Próximos Passos

1. **Execute o diagnóstico** usando o endpoint `/api/diagnose-user/:uid`
2. **Verifique se há dispositivos registrados** com tokens válidos
3. **Se não houver tokens**, o app precisa registrar novamente
4. **Se houver tokens inválidos**, eles foram removidos e o app precisa registrar novamente
5. **Se houver cooldown ativo**, aguarde 1 hora ou teste com uma localização diferente

## Contato

Se o problema persistir após seguir todos os passos, compartilhe:
- Resposta do endpoint `/api/diagnose-user/:uid`
- Logs do app mobile ao tentar registrar o token
- Resposta do endpoint `/api/test-notification`
