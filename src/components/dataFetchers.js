import { doc, collection, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// Función genérica para obtener el número total de jugadores
export const fetchPlayerCount = async (gameId) => {
  try {
    const gameRef = doc(db, 'games', gameId); // Cambia si usas otra colección
    const gameDoc = await getDoc(gameRef);
    if (gameDoc.exists()) {
      return gameDoc.data().playerCount || 1; // Default: 1 jugador
    }
    console.error("Game document not found");
    return 1;
  } catch (error) {
    console.error("Error fetching player count:", error);
    return 1;
  }
};

export const fetchResponses = async (gameId, blockId) => {
  try {
    console.log(`Fetching responses from: blockchain/${gameId}/blocks/${blockId}`);
    const blockRef = doc(db, 'blockchain', gameId, 'blocks', blockId);
    const blockSnapshot = await getDoc(blockRef);

    if (blockSnapshot.exists()) {
      const blockData = blockSnapshot.data();
      const responses = blockData.responses || []; // Extrae el campo 'responses' del documento
      console.log("Fetched responses:", responses);
      return responses;
    } else {
      console.warn("Block not found yet, responses will be fetched once it exists.");
      return [];
    }
  } catch (error) {
    console.error("Error fetching responses:", error);
    return [];
  }
};

export const fetchUserName = async (userId) => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.userName || "Unknown";
    } else {
      console.warn(`User with ID ${userId} not found.`);
      return "Unknown";
    }
  } catch (error) {
    console.error("Error fetching userName:", error);
    return "Unknown";
  }
};
