let admin;

function isConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function getAdmin() {
  if (!isConfigured()) return null;
  if (admin) return admin;
  const firebaseAdmin = require('firebase-admin');
  admin = firebaseAdmin.apps.length
    ? firebaseAdmin.app()
    : firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
  return admin;
}

async function optionalUser(request) {
  const authorization = request.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const firebase = getAdmin();
  if (!firebase) return null;
  try {
    const token = await firebase.auth().verifyIdToken(authorization.slice(7));
    return { uid: token.uid, email: token.email || '', displayName: token.name || undefined };
  } catch {
    return null;
  }
}

module.exports = { optionalUser };
