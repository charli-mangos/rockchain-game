/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const { createGame } = require('./src/handlers/createGame');
const { joinGame } = require('./src/handlers/joinGame');
const { deleteGame } = require('./src/handlers/deleteGame');
const { startGame } = require('./src/handlers/startGame');
const { generateGlobalProducts } = require('./src/handlers/generateGlobalProducts');
const { assignProductsToGame } = require('./src/handlers/assignProductsToGame');
const { updateProductPrices } = require('./src/handlers/updateProductPrices');
const { submitMiningSolution } = require('./src/handlers/submitMiningSolution');
const { roundTimer } = require('./src/handlers/roundTimer');
const { selectWinningIndustry } = require('./src/handlers/selectWinningIndustry');
const { endRound } = require('./src/handlers/endRound');
const { evaluateRound } = require('./src/handlers/evaluateRound');
const { updateUserProfile } = require('./src/handlers/updateUserProfile');
const { leaveGame } = require('./src/handlers/leaveGame');
const { startNextRound } = require('./src/handlers/startNextRound');

exports.createGame = createGame;
exports.joinGame = joinGame;
exports.deleteGame = deleteGame;
exports.startGame = startGame;
exports.generateGlobalProducts = generateGlobalProducts;
exports.submitMiningSolution = submitMiningSolution;
exports.assignProductsToGame = assignProductsToGame;
exports.updateProductPrices = updateProductPrices;
exports.roundTimer = roundTimer;
exports.selectWinningIndustry = selectWinningIndustry;
exports.endRound = endRound;
exports.evaluateRound = evaluateRound;
exports.updateUserProfile = updateUserProfile;
exports.leaveGame = leaveGame;
exports.startNextRound = startNextRound;
// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });