// db.js

// Importa a classe Pool do pacote 'pg'
const { Pool } = require('pg');

// Cria uma nova "piscina" de conexões.
// O construtor da Pool irá automaticamente usar a variável de ambiente
// DATABASE_URL se ela estiver disponível, que é o caso no Railway.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Configuração necessária para conexões SSL em ambientes de produção como o Railway
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Módulo de banco de dados (db.js) carregado e pool de conexões criada.');

// Exportamos um objeto com um método 'query' que usa a nossa pool.
// Desta forma, usamos a mesma pool em toda a aplicação.
module.exports = {
  query: (text, params) => pool.query(text, params),
};