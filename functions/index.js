// functions/index.js
// Funciones callable que usa la app. Todas exigen usuario autenticado y
// comprueban el rol (host o jugador) cuando actúan sobre una partida.
// La lógica de mercado, industria ganadora y evaluación de rondas es interna
// (src/handlers/*) y no se expone como endpoint.
const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp();
}

const { createGame } = require('./src/handlers/createGame');
const { joinGame } = require('./src/handlers/joinGame');
const { deleteGame } = require('./src/handlers/deleteGame');
const { startGame } = require('./src/handlers/startGame');
const { submitMiningSolution } = require('./src/handlers/submitMiningSolution');
const { endRound } = require('./src/handlers/endRound');
const { updateUserProfile } = require('./src/handlers/updateUserProfile');
const { leaveGame } = require('./src/handlers/leaveGame');
const { startNextRound } = require('./src/handlers/startNextRound');

exports.createGame = createGame;
exports.joinGame = joinGame;
exports.deleteGame = deleteGame;
exports.startGame = startGame;
exports.submitMiningSolution = submitMiningSolution;
exports.endRound = endRound;
exports.updateUserProfile = updateUserProfile;
exports.leaveGame = leaveGame;
exports.startNextRound = startNextRound;
