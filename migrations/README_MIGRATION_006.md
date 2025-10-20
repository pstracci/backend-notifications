# Migration 006: Adicionar alert_type ao Cooldown

## Problema
O sistema estava tentando usar `ON CONFLICT (user_id, latitude, longitude, alert_type)`, mas a constraint única no banco era apenas `UNIQUE(user_id, latitude, longitude)`.

## Solução
Esta migration adiciona a coluna `alert_type` à tabela `notification_cooldown` e atualiza a constraint única para incluir o tipo de alerta.

## O que esta migration faz:

1. ✅ Adiciona coluna `alert_type` (VARCHAR(50))
2. ✅ Atualiza registros existentes com valor padrão 'rain_now'
3. ✅ Remove constraint antiga `unique_user_location`
4. ✅ Cria nova constraint `unique_user_location_alert` incluindo `alert_type`
5. ✅ Remove colunas antigas específicas de chuva (`intensity_level`, `precipitation`)
6. ✅ Adiciona índice para `alert_type`

## Como aplicar:

### Opção 1: Usando Node.js (Recomendado)
```bash
node apply-migration-006.js
```

### Opção 2: Diretamente no PostgreSQL
```bash
psql -U postgres -d weather_alerts -f migrations/006_add_alert_type_to_cooldown.sql
```

### Opção 3: Via Docker (se o banco estiver em container)
```bash
docker exec -i postgres_container psql -U postgres -d weather_alerts < migrations/006_add_alert_type_to_cooldown.sql
```

## Verificação
Após aplicar a migration, você pode verificar a estrutura:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_cooldown'
ORDER BY ordinal_position;

SELECT 
  constraint_name, 
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'notification_cooldown';
```

## Resultado Esperado
A tabela `notification_cooldown` deve ter:
- Coluna `alert_type` (VARCHAR, NOT NULL)
- Constraint única: `unique_user_location_alert (user_id, latitude, longitude, alert_type)`
- Sem as colunas `intensity_level` e `precipitation`

## Impacto
✅ **Sem downtime**: A migration é segura e pode ser aplicada com o sistema rodando
✅ **Compatível**: O código já foi atualizado para usar a nova estrutura
✅ **Cooldown por tipo**: Agora cada tipo de alerta tem seu próprio cooldown independente
