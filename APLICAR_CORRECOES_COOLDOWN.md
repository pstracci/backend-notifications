# 🚀 Guia Rápido: Aplicar Correções do Cooldown

## ⚡ Passos Rápidos

### 1️⃣ Diagnosticar o problema atual
```bash
node diagnose-cooldown.js
```

Este script irá:
- ✅ Verificar estrutura da tabela
- ✅ Identificar colunas faltantes
- ✅ **Detectar espaço extra na coluna severity** 🚨
- ✅ Mostrar registros recentes
- ✅ Verificar arredondamento de coordenadas
- ✅ Dar recomendações específicas

---

### 2️⃣ Aplicar Migration 008 (CRÍTICO!)
```bash
node apply-migration-008.js
```

**⚠️ IMPORTANTE:** Esta migration corrige um erro crítico onde a coluna `"severity "` tem um espaço extra no nome, impedindo que o cooldown funcione!

---

### 3️⃣ Aplicar Migration 007 (se necessário)
```bash
node apply-migration-007.js
```

Este script irá:
- ✅ Adicionar colunas `severity` e `alert_value`
- ✅ Criar índices necessários
- ✅ Limpar registros antigos (> 2 horas)
- ✅ Mostrar estrutura final da tabela

**Saída esperada:**
```
🔧 Aplicando Migration 007: Adicionar severity e alert_value ao cooldown

📝 Executando migration...

✅ Migration aplicada com sucesso!

🧹 Limpando registros antigos de cooldown (> 2 horas)...
✅ 15 registro(s) antigo(s) removido(s)

📊 Estrutura final da tabela:

  ✓ id                        integer              NOT NULL
  ✓ user_id                   integer              NOT NULL
  ✓ latitude                  numeric              NOT NULL
  ✓ longitude                 numeric              NOT NULL
  ✓ alert_type                character varying    NOT NULL
  ✓ severity                  character varying    NULLABLE
  ✓ alert_value               numeric              NULLABLE
  ✓ last_notification_at      timestamp            NOT NULL
  ✓ created_at                timestamp            NULLABLE

🎉 Tudo pronto! O cooldown agora está corrigido.
```

---

### 4️⃣ Reiniciar o servidor
```bash
# Se estiver usando PM2
pm2 restart meu-backend-notificacoes

# Ou parar e iniciar novamente
pm2 stop meu-backend-notificacoes
pm2 start meu-backend-notificacoes

# Ou simplesmente
npm start
```

---

### 5️⃣ Verificar se está funcionando
```bash
# Monitorar logs em tempo real
pm2 logs meu-backend-notificacoes

# Ou executar diagnóstico novamente
node diagnose-cooldown.js
```

**Logs esperados após correção:**
```
📝 Cooldown registrado para usuário 8 em -23.72, -46.55 (uv_high, severity: very_high, value: 9.1)
⏳ Usuário 8 em cooldown para -23.72, -46.55 (última notificação há 15 minutos)
```

---

## 🔍 Verificações Importantes

### ✅ Checklist Pós-Correção

Após aplicar as correções, verifique:

- [ ] **Migration aplicada:** `node diagnose-cooldown.js` mostra colunas `severity` e `alert_value`
- [ ] **Servidor reiniciado:** Código atualizado está rodando
- [ ] **Coordenadas arredondadas:** Logs mostram coordenadas com 2 casas decimais (ex: -23.72)
- [ ] **Severity preenchido:** Logs mostram "severity: very_high" ou similar
- [ ] **Alert_value preenchido:** Logs mostram "value: 9.1" ou similar
- [ ] **Cooldown funcionando:** Não recebe notificações a cada 15 minutos

---

## 🐛 Troubleshooting

### Problema: "Erro ao registrar cooldown"

**Possível causa:** Colunas `severity` ou `alert_value` não existem

**Solução:**
```bash
node apply-migration-007.js
pm2 restart meu-backend-notificacoes
```

---

### Problema: Ainda recebendo notificações frequentes

**Possível causa 1:** Código antigo ainda está rodando

**Solução:**
```bash
# Parar completamente o servidor
pm2 stop meu-backend-notificacoes
pm2 delete meu-backend-notificacoes

# Iniciar novamente
pm2 start index.js --name meu-backend-notificacoes
```

**Possível causa 2:** Registros antigos com coordenadas não arredondadas

**Solução:**
```bash
# Limpar todos os registros de cooldown
psql -U seu_usuario -d seu_banco -c "DELETE FROM notification_cooldown"

# Ou limpar apenas registros antigos
psql -U seu_usuario -d seu_banco -c "DELETE FROM notification_cooldown WHERE last_notification_at < NOW() - INTERVAL '2 hours'"
```

---

### Problema: Coordenadas não arredondadas nos logs

**Exemplo de log errado:**
```
📝 Cooldown registrado para usuário 8 em -23.7234567, -46.5512345
```

**Exemplo de log correto:**
```
📝 Cooldown registrado para usuário 8 em -23.72, -46.55
```

**Solução:**
1. Verifique se o arquivo `notificationService.js` foi atualizado
2. Reinicie o servidor completamente
3. Limpe registros antigos do banco

---

### Problema: Severity e alert_value NULL no banco

**Verificar:**
```bash
node diagnose-cooldown.js
```

Procure por:
```
Registros com severity: 0 (0%)
Registros com alert_value: 0 (0%)
```

**Solução:**
1. Verifique se o código atualizado está rodando
2. Limpe registros antigos
3. Aguarde novos alertas serem processados

---

## 📊 Monitoramento

### Ver logs em tempo real
```bash
pm2 logs meu-backend-notificacoes --lines 100
```

### Ver apenas erros
```bash
pm2 logs meu-backend-notificacoes --err
```

### Ver status do servidor
```bash
pm2 status
```

### Ver informações detalhadas
```bash
pm2 info meu-backend-notificacoes
```

---

## 🗄️ Comandos Úteis do Banco de Dados

### Ver registros recentes de cooldown
```sql
SELECT 
  user_id, 
  latitude, 
  longitude, 
  alert_type, 
  severity, 
  alert_value,
  last_notification_at,
  EXTRACT(EPOCH FROM (NOW() - last_notification_at))/60 as minutes_ago
FROM notification_cooldown
WHERE last_notification_at > NOW() - INTERVAL '2 hours'
ORDER BY last_notification_at DESC;
```

### Limpar todos os registros de cooldown
```sql
DELETE FROM notification_cooldown;
```

### Limpar apenas registros antigos (> 2 horas)
```sql
DELETE FROM notification_cooldown 
WHERE last_notification_at < NOW() - INTERVAL '2 hours';
```

### Verificar estrutura da tabela
```sql
\d notification_cooldown
```

---

## 📚 Arquivos Criados/Modificados

### Arquivos Modificados
- ✅ `notificationService.js` - Corrigido arredondamento e preenchimento de severity/value

### Arquivos Criados
- ✅ `migrations/007_add_severity_and_value_to_cooldown.sql` - Migration para adicionar colunas
- ✅ `apply-migration-007.js` - Script para aplicar migration
- ✅ `diagnose-cooldown.js` - Script de diagnóstico
- ✅ `COOLDOWN_FIX_REPORT.md` - Relatório detalhado das correções
- ✅ `APLICAR_CORRECOES_COOLDOWN.md` - Este guia

---

## 💡 Dicas

1. **Sempre execute o diagnóstico primeiro:** `node diagnose-cooldown.js`
2. **Monitore os logs após reiniciar:** `pm2 logs meu-backend-notificacoes`
3. **Limpe registros antigos periodicamente:** Evita acúmulo de dados desnecessários
4. **Verifique as coordenadas nos logs:** Devem ter apenas 2 casas decimais

---

## ✅ Resultado Esperado

Após aplicar todas as correções, você deve ver nos logs:

```
🌍 Consultando dados para: -23.72, -46.55
   ⚠️ 1 alerta(s) detectado(s):
      - uv_high: Índice UV ALTO: 9.1

📝 Cooldown registrado para usuário 8 em -23.72, -46.55 (uv_high, severity: very_high, value: 9.1)

[15 minutos depois, mesmo local]

⏳ Usuário 8 em cooldown para -23.72, -46.55 (última notificação há 15 minutos)
  📱 0 para notificar, 1 em cooldown
  ⏭️ Todos em cooldown
```

**Notificação NÃO será enviada novamente até completar 1 hora!** ✅

---

**Data:** 21 de Outubro de 2025  
**Versão:** 1.0  
**Status:** ✅ Pronto para uso
