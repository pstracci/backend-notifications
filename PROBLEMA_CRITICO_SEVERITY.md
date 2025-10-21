# 🚨 PROBLEMA CRÍTICO: Coluna "severity " com Espaço Extra

## ⚠️ Problema Identificado

A coluna `severity` na tabela `notification_cooldown` tem um **ESPAÇO EXTRA** no final do nome:

```sql
"severity " text NULL,  -- ❌ Nome incorreto: "severity " (com espaço)
```

**Nome correto deveria ser:**
```sql
severity text NULL,     -- ✅ Nome correto: "severity" (sem espaço)
```

---

## 💥 Impacto

Este erro faz com que **TODAS as inserções de cooldown falhem silenciosamente!**

### O que acontece:

1. **Código tenta inserir:**
   ```javascript
   INSERT INTO notification_cooldown (..., severity, alert_value, ...)
   VALUES (..., 'very_high', 9.1, ...)
   ```

2. **Banco de dados procura coluna `severity`** (sem espaço)

3. **Não encontra** porque a coluna real é `"severity "` (com espaço)

4. **Erro:** `column "severity" does not exist`

5. **Resultado:** 
   - ❌ Cooldown não é registrado
   - ❌ Notificações são enviadas repetidamente
   - ❌ Colunas `severity` e `alert_value` ficam NULL

---

## 🔍 Como Verificar

Execute o diagnóstico:
```bash
node diagnose-cooldown.js
```

Procure por:
```
🚨 severity: ERRO - Coluna tem ESPAÇO EXTRA no nome ("severity ")!
   ⚠️  Execute migration 008 para corrigir!
```

Ou verifique diretamente no banco:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
  AND column_name LIKE 'severity%';
```

Se retornar `"severity "` (com espaço), o problema existe!

---

## ✅ Solução

### **Passo 1: Aplicar Migration 008**

```bash
node apply-migration-008.js
```

Esta migration irá:
- ✅ Renomear `"severity "` → `severity`
- ✅ Recriar índice
- ✅ Verificar estrutura final

### **Passo 2: Reiniciar o Servidor**

```bash
pm2 restart meu-backend-notificacoes
```

### **Passo 3: Verificar**

```bash
node diagnose-cooldown.js
```

Deve mostrar:
```
✅ severity: OK
```

---

## 📊 Antes vs Depois

### **ANTES (Errado):**

```sql
-- Estrutura da tabela
CREATE TABLE notification_cooldown (
  ...
  "severity " text NULL,  -- ❌ Com espaço!
  ...
);

-- Código tenta inserir
INSERT INTO notification_cooldown (..., severity, ...)  -- Sem espaço
VALUES (..., 'very_high', ...);

-- ERRO: column "severity" does not exist
-- Cooldown NÃO é registrado!
```

### **DEPOIS (Correto):**

```sql
-- Estrutura da tabela
CREATE TABLE notification_cooldown (
  ...
  severity text NULL,  -- ✅ Sem espaço!
  ...
);

-- Código insere
INSERT INTO notification_cooldown (..., severity, ...)  -- Sem espaço
VALUES (..., 'very_high', ...);

-- ✅ SUCESSO: Cooldown registrado!
```

---

## 🔧 Migration 008

**Arquivo:** `migrations/008_fix_severity_column_name.sql`

```sql
-- Renomear coluna "severity " para "severity"
ALTER TABLE notification_cooldown 
RENAME COLUMN "severity " TO severity;

-- Recriar índice
DROP INDEX IF EXISTS idx_cooldown_severity;
CREATE INDEX idx_cooldown_severity ON notification_cooldown(severity);
```

---

## 🎯 Por Que Isso Aconteceu?

Provavelmente a coluna foi criada com um erro de digitação:

```sql
-- Migration anterior (errada)
ALTER TABLE notification_cooldown 
ADD COLUMN "severity " text;  -- ❌ Espaço extra antes das aspas de fechamento
```

**Deveria ser:**
```sql
-- Correto
ALTER TABLE notification_cooldown 
ADD COLUMN severity text;  -- ✅ Sem espaço
```

---

## ⚠️ IMPORTANTE

**Este é o problema principal que impede o cooldown de funcionar!**

Mesmo com todas as outras correções implementadas (arredondamento de coordenadas, etc.), o cooldown **NÃO FUNCIONARÁ** enquanto a coluna tiver o espaço extra no nome.

**Prioridade:** 🔴 **URGENTE - Aplicar imediatamente!**

---

## 📋 Checklist

- [ ] Executar `node diagnose-cooldown.js` para confirmar o problema
- [ ] Executar `node apply-migration-008.js` para corrigir
- [ ] Reiniciar o servidor
- [ ] Verificar logs: deve mostrar "severity: very_high, value: 9.1"
- [ ] Confirmar que cooldown está funcionando (não recebe notificações a cada 15 min)

---

**Data:** 21 de Outubro de 2025  
**Status:** 🚨 CRÍTICO - Requer ação imediata  
**Migration:** 008_fix_severity_column_name.sql
