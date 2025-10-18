# ⚡ Correção Rápida - Cooldown por Usuário

## 🎯 Problema
```
error: relation "notification_cooldown" does not exist
```

## ✅ Solução Rápida (3 passos)

### 1️⃣ Copie o SQL para o seu banco de dados

Abra o arquivo: **`migrations/APPLY_COOLDOWN_FIX.sql`**

### 2️⃣ Execute no PostgreSQL

**Via Docker:**
```bash
docker exec -i seu-postgres-container psql -U usuario -d database < migrations/APPLY_COOLDOWN_FIX.sql
```

**Via psql local:**
```bash
psql -h host -U usuario -d database -f migrations/APPLY_COOLDOWN_FIX.sql
```

**Via pgAdmin/DBeaver:**
- Abra o arquivo `APPLY_COOLDOWN_FIX.sql`
- Copie todo o conteúdo
- Cole no query editor
- Execute

### 3️⃣ Reinicie o servidor

```bash
docker restart seu-app-container
# ou
docker-compose restart app
```

---

## 🔍 Como Saber se Funcionou?

Verifique os logs após reiniciar:

```bash
docker logs -f seu-app-container
```

**Antes (com erro):**
```
❌ Erro ao verificar cooldown: relation "notification_cooldown" does not exist
```

**Depois (funcionando):**
```
✅ Processamento concluído
📱 2 usuário(s) para notificar, 0 em cooldown
📝 Cooldown registrado para usuário 1 em -23.72, -46.55
```

---

## 📦 Alternativa: Script Automático

Se preferir usar o script Node.js:

```bash
# Dentro do container
docker exec -it seu-app-container node setup-cooldown.js
```

---

## 🆘 Precisa de Ajuda?

1. **Não tem acesso ao banco?** → Peça ao administrador para executar o SQL
2. **Erro de permissão?** → Verifique se o usuário tem permissão para ALTER TABLE
3. **Tabela users não existe?** → Execute primeiro as migrations de criação de usuários

---

## 📋 O que Muda?

**Antes:** Cooldown por região (bloqueava todos os usuários)
```
Região A → 1 notificação/hora (para TODOS os usuários)
```

**Depois:** Cooldown por usuário (individual)
```
Região A → Usuário 1: 1 notificação/hora
         → Usuário 2: 1 notificação/hora (independente)
         → Usuário 3: 1 notificação/hora (independente)
```
