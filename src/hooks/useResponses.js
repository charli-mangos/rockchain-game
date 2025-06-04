import { useState, useEffect } from 'react';
import { fetchResponses } from '../components/dataFetchers'; // Ajusta la ruta

export const useResponses = (gameId, blockId) => {
  const [responses, setResponses] = useState([]);

  // Obtener respuestas iniciales
  useEffect(() => {
    const fetchInitialResponses = async () => {
      if (gameId && blockId) {
        const initialResponses = await fetchResponses(gameId, blockId);
        setResponses(initialResponses);
      }
    };
    fetchInitialResponses();
  }, [gameId, blockId]);

  // Método para forzar la actualización de respuestas
  const updateResponses = async () => {
    if (gameId && blockId) {
      const updatedResponses = await fetchResponses(gameId, blockId);
      setResponses(updatedResponses);
    }
  };

  return { responses, updateResponses };
};
