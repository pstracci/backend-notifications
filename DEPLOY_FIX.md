# 🚀 Como Aplicar a Correção no Ambiente de Produção

## Opção 1: Executar SQL Diretamente (Mais Rápido)

### Se você tem acesso ao PostgreSQL via psql ou pgAdmin:

1. **Conecte ao banco de dados de produção**
2. **Execute o arquivo SQL:**
   ```sql
   -- Copie e cole o conteúdo de: migrations/APPLY_COOLDOWN_FIX.sql
   ```

### Via linha de comando (psql):
```bash
psql -h <host> -U <usuario> -d <database> -f migrations/APPLY_COOLDOWN_FIX.sql
```

### Via Docker (se o banco está em container):
```bash
docker exec -i <postgres-container> psql -U <usuario> -d <database> < migrations/APPLY_COOLDOWN_FIX.sql
```

---

## Opção 2: Via Script Node.js no Container

### 1. Copie os arquivos para o container:
```bash
docker cp setup-cooldown.js <container-name>:/app/
docker cp migrations/004_update_cooldown_per_user.sql <container-name>:/app/migrations/
```

### 2. Execute dentro do container:
```bash
docker exec -it <container-name> node setup-cooldown.js
```

---

## Opção 3: Rebuild do Container com Migration Automática

### Adicione ao seu `docker-compose.yml`:

```yaml
services:
  app:
    # ... outras configs
    command: sh -c "node setup-cooldown.js && node index.js"
```

Ou no `Dockerfile`:

```dockerfile
# Adicione antes do CMD
COPY migrations/ ./migrations/
COPY setup-cooldown.js ./
RUN node setup-cooldown.js || true
```

Depois:
```bash
docker-compose down
docker-compose up --build
```

---

## Opção 4: Executar Manualmente no Container em Execução

```bash
# Entrar no container
docker exec -it <container-name> sh

# Dentro do container
node setup-cooldown.js
```

---

## Verificar se Funcionou

Após aplicar a correção, verifique os logs do container:

```bash
docker logs -f <container-name>
```

Você deve ver:
- ✅ Sem erros de "relation notification_cooldown does not exist"
- ✅ Mensagens como: `📱 X usuário(s) para notificar, Y em cooldown`
- ✅ `📝 Cooldown registrado para usuário X em lat, lng`

---

## Troubleshooting

### Se o script falhar com erro de conexão:
- Verifique se as variáveis de ambiente do banco estão corretas
- Confirme que o banco de dados está acessível do container

### Se a tabela já existir mas sem user_id:
Execute apenas a parte relevante do SQL:
```sql
TRUNCATE TABLE notification_cooldown;
ALTER TABLE notification_cooldown ADD COLUMN user_id INTEGER NOT NULL;
ALTER TABLE notification_cooldown ADD CONSTRAINT fk_cooldown_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_cooldown ADD CONSTRAINT unique_user_location 
  UNIQUE(user_id, latitude, longitude);
```

---

## Qual Opção Escolher?

- **Opção 1** (SQL direto): ⚡ Mais rápido, recomendado se você tem acesso ao banco
- **Opção 2** (Script no container): 🔧 Bom para ambientes Docker isolados
- **Opção 3** (Rebuild): 🏗️ Melhor para deploy permanente
- **Opção 4** (Manual): 🐛 Útil para debug e testes
