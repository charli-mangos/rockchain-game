// functions/src/utils/auth.js
// Comprobaciones de autenticación y de rol comunes a las funciones callable.
const { HttpsError } = require('firebase-functions/v2/https');

// Devuelve el uid del usuario autenticado o lanza 'unauthenticated'
const requireAuth = (request) => {
  const uid = request && request.auth && request.auth.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  return uid;
};

// Valida un identificador de documento recibido del cliente
const requireId = (value, name = 'id') => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `${name} is required`);
  }
  return value;
};

const isHost = (gameData, uid) => !!gameData && gameData.hostId === uid;

const isParticipant = (gameData, uid) =>
  !!gameData && (isHost(gameData, uid) || (Array.isArray(gameData.players) && gameData.players.includes(uid)));

const assertHost = (gameData, uid) => {
  if (!isHost(gameData, uid)) {
    throw new HttpsError('permission-denied', 'Only the game host can do this');
  }
};

const assertParticipant = (gameData, uid) => {
  if (!isParticipant(gameData, uid)) {
    throw new HttpsError('permission-denied', 'You are not a player in this game');
  }
};

// Nombre visible: texto de 1 a 40 caracteres
const sanitizeUserName = (userName) => {
  if (typeof userName !== 'string' || userName.trim().length === 0 || userName.trim().length > 40) {
    throw new HttpsError('invalid-argument', 'User name must have between 1 and 40 characters');
  }
  return userName.trim();
};

// Imagen de perfil: URI opcional de hasta 2048 caracteres. Se aceptan https y las
// URIs locales que devuelve expo-image-picker (file:, content:, ph:); nada de javascript: o data:
const sanitizeImageUrl = (imageUrl) => {
  if (imageUrl === undefined || imageUrl === null || imageUrl === '') return null;
  if (typeof imageUrl !== 'string' || imageUrl.length > 2048 ||
      !/^(https|file|content|ph):\/\//i.test(imageUrl.trim())) {
    throw new HttpsError('invalid-argument', 'imageUrl must be an https or local image URI');
  }
  return imageUrl.trim();
};

module.exports = {
  requireAuth,
  requireId,
  isHost,
  isParticipant,
  assertHost,
  assertParticipant,
  sanitizeUserName,
  sanitizeImageUrl,
};
