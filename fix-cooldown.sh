#!/bin/sh
# Script para aplicar correção de cooldown no container Docker

echo "🚀 Aplicando correção de cooldown..."
echo ""

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/APPLY_COOLDOWN_FIX.sql" ]; then
  echo "❌ Arquivo migrations/APPLY_COOLDOWN_FIX.sql não encontrado"
  exit 1
fi

# Executar via node se possível
if [ -f "setup-cooldown.js" ]; then
  echo "📦 Executando via Node.js..."
  node setup-cooldown.js
  exit $?
fi

# Fallback: tentar executar SQL diretamente
echo "📄 Executando SQL diretamente..."
echo "⚠️  Certifique-se de que as variáveis de ambiente do banco estão configuradas"
echo ""

# Usar psql se disponível
if command -v psql > /dev/null 2>&1; then
  psql -f migrations/APPLY_COOLDOWN_FIX.sql
  exit $?
fi

echo "❌ Não foi possível executar a migração automaticamente"
echo "📋 Execute manualmente: node setup-cooldown.js"
exit 1
