import { useState, useEffect } from 'react';
import { fetchPlayerCount } from '../components/dataFetchers'; // Ajusta la ruta

export const usePlayerCount = (gameId) => {
  const [playerCount, setPlayerCount] = useState(1); // Default para pruebas

  useEffect(() => {
    const loadPlayerCount = async () => {
      const count = await fetchPlayerCount(gameId);
      setPlayerCount(count);
    };
    loadPlayerCount();
  }, [gameId]);

  return playerCount;
};