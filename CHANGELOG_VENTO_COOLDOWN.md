# Correções de Notificações de Vento e Cooldown

## Data: 2025-10-20

### Problemas Identificados e Corrigidos

#### 1. ⚠️ Notificações de Vento Muito Frequentes

**Problema:** Notificações de vento estavam sendo enviadas com muita frequência, mesmo quando o vento não estava forte.

**Causa:** Threshold muito baixo (30 km/h) para alertas de vento.

**Solução Implementada:**
- **Arquivo:** `weatherService.js` (linhas 65-69)
- **Mudança:** Aumentado threshold de **30 km/h** para **50 km/h**
- **Níveis atualizados:**
  - `< 50 km/h`: Sem alerta (calm)
  - `50-70 km/h`: Vento forte (strong) - ALERTA
  - `>= 70 km/h`: Vento muito forte (very_strong) - ALERTA

**Impacto:** Agora apenas ventos realmente fortes (>= 50 km/h) dispararão notificações.

---

#### 2. ⚠️ Rajadas Previstas com Threshold Inconsistente

**Problema:** Rajadas previstas alertavam com 40 km/h, inconsistente com o novo threshold.

**Solução Implementada:**
- **Arquivo:** `weatherService.js` (linha 170)
- **Mudança:** Aumentado threshold de **40 km/h** para **60 km/h**
- **Severidade:** Alterada de `moderate` para `strong`

---

#### 3. 🕐 Cron Jobs Coincidindo

**Problema:** Todos os alertas rodavam no mesmo cron, podendo enviar múltiplas notificações no mesmo minuto.

**Solução Implementada:**
- **Arquivo:** `index.js` (linha 285)
- **Mudança:** Cron principal agora roda em minutos específicos: `0,15,30,45 * * * *`
- **Horários:** 00:00, 00:15, 00:30, 00:45 de cada hora

**Impacto:** Notificações agora são enviadas apenas nos minutos 0, 15, 30 e 45.

---

#### 4. 🧹 Falta de Limpeza de Cooldown

**Problema:** Registros de cooldown nunca eram removidos, acumulando dados desnecessários no banco.

**Solução Implementada:**
- **Arquivo:** `index.js` (linhas 315-348)
- **Novo Cron Job:** `5 * * * *` (roda a cada hora no minuto 5)
- **Funcionalidade:**
  - Remove registros com mais de 1 hora
  - Exibe estatísticas da tabela
  - Log detalhado da operação

**Impacto:** Banco de dados mantém apenas registros ativos, melhorando performance.

---

### Novos Endpoints de Teste

#### POST `/api/cleanup-cooldown-now`
Executa limpeza manual de cooldown para testes.

**Resposta:**
```json
{
  "success": true,
  "message": "Limpeza concluída",
  "removed": 15,
  "remaining": 42
}
```

---

### Cronograma de Execução

| Cron Job | Horário | Descrição |
|----------|---------|-----------|
| Alertas Meteorológicos | `0,15,30,45 * * * *` | Verifica alertas nos minutos 0, 15, 30, 45 |
| Limpeza de Cooldown | `5 * * * *` | Limpa registros expirados no minuto 5 de cada hora |

**Exemplo de execução em 1 hora:**
- 10:00 - Verificação de alertas
- 10:05 - Limpeza de cooldown
- 10:15 - Verificação de alertas
- 10:30 - Verificação de alertas
- 10:45 - Verificação de alertas
- 11:00 - Verificação de alertas
- 11:05 - Limpeza de cooldown
- ...

---

### Testes Recomendados

1. **Testar threshold de vento:**
   - Aguardar condições de vento entre 30-49 km/h (não deve alertar)
   - Aguardar condições de vento >= 50 km/h (deve alertar)

2. **Testar limpeza de cooldown:**
   ```bash
   curl -X POST http://localhost:3000/api/cleanup-cooldown-now
   ```

3. **Verificar logs dos crons:**
   - Observar logs no minuto 0, 15, 30, 45 para alertas
   - Observar logs no minuto 5 de cada hora para limpeza

---

### Arquivos Modificados

- ✅ `weatherService.js` - Thresholds de vento atualizados
- ✅ `index.js` - Cron jobs separados e limpeza de cooldown adicionada

### Arquivos Criados

- 📄 `CHANGELOG_VENTO_COOLDOWN.md` - Esta documentação
