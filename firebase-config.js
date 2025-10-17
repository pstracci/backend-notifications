const admin = require("firebase-admin");

// ATENÇÃO: As credenciais virão das variáveis de ambiente!
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;