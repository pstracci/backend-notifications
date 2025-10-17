// authMiddleware.js

const admin = require('./firebase-config');

const authMiddleware = async (req, res, next) => {
  // Pega o token do cabeçalho 'Authorization'
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: 'Não autorizado. Nenhum token fornecido.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verifica o token usando o Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Anexa o UID do usuário ao objeto 'req' para que possamos usá-lo no endpoint
    req.user = {
      uid: decodedToken.uid
    };

    // Passa para o próximo passo (o nosso endpoint)
    next();
  } catch (error) {
    console.error('Erro ao verificar o token de autenticação:', error);
    return res.status(403).send({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;