// server/lib/socketAuth.js
// Autenticación de las conexiones Socket.IO y control de acceso por partida.
// Son funciones puras (reciben sus dependencias) para poder probarlas sin Firebase.

// Middleware de handshake: exige un ID token de Firebase en `auth.token`
// y guarda el uid verificado en socket.data.uid.
const createSocketAuthMiddleware = (verifyIdToken) => async (socket, next) => {
  const token = socket && socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
    return next(new Error('unauthorized'));
  }
  try {
    const decoded = await verifyIdToken(token);
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) {
      return next(new Error('unauthorized'));
    }
    socket.data = socket.data || {};
    socket.data.uid = decoded.uid;
    return next();
  } catch (error) {
    return next(new Error('unauthorized'));
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// El userId de cualquier evento es siempre el del token, nunca el que envía el cliente.
const bindPayloadToUser = (payload, uid) => {
  if (isPlainObject(payload)) {
    return { ...payload, userId: uid };
  }
  return payload;
};

// ¿Puede este usuario enviar eventos sobre esta partida?
// `room` es la sala en memoria (o undefined si no existe todavía).
const canActOnGame = (room, uid) =>
  !!room && Array.isArray(room.players) && room.players.some((p) => p && p.userId === uid);

// ¿Puede este usuario unirse a la sala? Debe figurar como jugador en Firestore
// (se añade con la Cloud Function joinGame/createGame).
const canJoinGame = (gameData, uid) =>
  !!gameData &&
  (gameData.hostId === uid || (Array.isArray(gameData.players) && gameData.players.includes(uid)));

// Eventos que no van ligados a una sala concreta o que la crean
const EVENTS_WITHOUT_ROOM_CHECK = new Set(['join_game', 'disconnect', 'error']);

// CORS_ORIGINS="https://a.example,https://b.example"
const parseCorsOrigins = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Los clientes nativos no envían cabecera Origin: se aceptan.
// Los navegadores solo si su origen está en la lista.
const isOriginAllowed = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin);

// Un origen no permitido no recibe cabeceras CORS (el navegador bloquea la respuesta)
const corsOriginCallback = (allowedOrigins) => (origin, callback) => {
  callback(null, isOriginAllowed(origin, allowedOrigins));
};

module.exports = {
  createSocketAuthMiddleware,
  bindPayloadToUser,
  canActOnGame,
  canJoinGame,
  EVENTS_WITHOUT_ROOM_CHECK,
  parseCorsOrigins,
  isOriginAllowed,
  corsOriginCallback,
};
