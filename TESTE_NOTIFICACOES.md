# 🧪 Guia de Teste de Notificações

## Problema Identificado

As notificações não estão chegando no app devido a possíveis problemas com:
1. **Tokens FCM inválidos ou expirados** no banco de dados
2. **Configuração do Firebase** no app
3. **Permissões de notificação** no dispositivo

## Como Testar

### 1. Testar Envio de Notificação Manualmente

Use o novo endpoint de teste criado:

```bash
curl -X POST http://localhost:3000/api/test-notification
```

Ou se estiver no Railway:
```bash
curl -X POST https://seu-app.railway.app/api/test-notification
```

### 2. Verificar os Logs

O endpoint retornará informações detalhadas:
- Total de tokens no banco
- Quantas notificações foram enviadas com sucesso
- Quantas falharam
- Códigos de erro específicos para cada falha

### 3. Códigos de Erro Comuns do Firebase

- **`messaging/invalid-registration-token`**: Token FCM inválido ou expirado
- **`messaging/registration-token-not-registered`**: Token não está mais registrado (app desinstalado)
- **`messaging/invalid-argument`**: Formato do token incorreto
- **`messaging/mismatched-credential`**: Credenciais do Firebase não correspondem ao app

## Soluções

### Se os tokens estão inválidos:

1. **No seu app**, certifique-se de que está enviando o token FCM correto:
   ```javascript
   // Exemplo React Native com @react-native-firebase/messaging
   import messaging from '@react-native-firebase/messaging';
   
   const token = await messaging().getToken();
   console.log('FCM Token:', token);
   
   // Enviar para o backend
   await fetch('http://seu-backend/register-device', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ token })
   });
   ```

2. **Limpar tokens antigos** do banco de dados:
   ```sql
   DELETE FROM devices;
   ```

3. **Registrar o dispositivo novamente** pelo app

### Se o Firebase não está configurado corretamente:

1. Verifique se o arquivo `firebase-config.js` tem as credenciais corretas
2. Confirme que o `google-services.json` (Android) ou `GoogleService-Info.plist` (iOS) no app corresponde ao projeto Firebase
3. Verifique se o FCM está habilitado no console do Firebase

### Se as permissões não foram concedidas:

1. No app, solicite permissões de notificação:
   ```javascript
   const authStatus = await messaging().requestPermission();
   const enabled =
     authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
     authStatus === messaging.AuthorizationStatus.PROVISIONAL;
   
   if (enabled) {
     console.log('Permissão concedida');
   }
   ```

## Verificar Banco de Dados

Para ver os tokens registrados:
```sql
SELECT id, token, created_at FROM devices;
```

Para ver quantos dispositivos estão registrados:
```sql
SELECT COUNT(*) FROM devices WHERE token IS NOT NULL;
```

## Próximos Passos

1. Execute o endpoint de teste: `POST /api/test-notification`
2. Verifique os logs do backend para ver os erros específicos
3. Com base nos códigos de erro, siga as soluções acima
4. Se necessário, compartilhe os logs para análise adicional
