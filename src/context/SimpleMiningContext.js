import React, { createContext, useContext, useState, useEffect } from 'react';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';

export const SimpleMiningContext = createContext();

export const SimpleMiningProvider = ({ children, gameId, userId }) => {
  console.log(`[SIMPLE-MINING] SimpleMiningProvider inicializado con gameId=${gameId}, userId=${userId}`);
  
  const [pendingCount, setPendingCount] = useState(0);
  const [problemViewStarts, setProblemViewStarts] = useState(new Map()); // Map<blockId, viewStart>
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [currentViewStart, setCurrentViewStart] = useState(null);

  // Función para solicitar problemas pendientes
  const requestPendingCount = () => {
    console.log(`[SIMPLE-MINING] Solicitando problemas pendientes para userId=${userId}`);
    
    if (!userId) {
      console.error('❌ userId requerido para requestPendingCount');
      return;
    }

    const webSocketService = getWebSocketService();
    if (!webSocketService.isConnected) {
      console.warn('⚠️ WebSocket no está conectado, esperando conexión...');
      // Esperar a que el WebSocket se conecte
      const checkConnection = () => {
        if (webSocketService.isConnected) {
          console.log('✅ WebSocket conectado, enviando solicitud de problemas pendientes');
          webSocketService.emit('mining:pending-count', { userId });
        } else {
          // Reintentar después de 500ms
          setTimeout(checkConnection, 500);
        }
      };
      checkConnection();
      return;
    }

    webSocketService.emit('mining:pending-count', { userId });
  };

  // Configurar listeners de WebSocket
  useEffect(() => {
    if (!gameId || !userId) {
      console.log(`[SIMPLE-MINING] No se configuran listeners: gameId=${gameId}, userId=${userId}`);
      return;
    }

    console.log(`[SIMPLE-MINING] Configurando listeners para gameId=${gameId}, userId=${userId}`);

    // Listener para problemas pendientes
    const handlePendingCountResult = (data) => {
      console.log(`[SIMPLE-MINING] Resultado recibido:`, data);
      const { userId: resultUserId, pendingCount: count } = data;
      
      if (resultUserId === userId) {
        console.log(`[SIMPLE-MINING] Actualizando pendingCount para ${userId}: ${count}`);
        setPendingCount(count);
      }
    };

    // Listener para nuevos problemas de minado
    const handleNewMiningProblem = (data) => {
      console.log(`[SIMPLE-MINING] Nuevo problema recibido:`, data);
      
      // Solicitar problemas pendientes actualizados después de un delay
      setTimeout(() => {
        requestPendingCount();
      }, 1000);
    };

    // Registrar listeners
    const webSocketService = getWebSocketService();
    webSocketService.on('mining:pending-count:result', handlePendingCountResult);
    webSocketService.on('new_mining_problem', handleNewMiningProblem);

    // Solicitar problemas pendientes al conectar
    setTimeout(() => {
      requestPendingCount();
    }, 2000);

    // Cleanup
    return () => {
      console.log(`[SIMPLE-MINING] Limpiando listeners para gameId=${gameId}, userId=${userId}`);
      const webSocketService = getWebSocketService();
      webSocketService.off('mining:pending-count:result', handlePendingCountResult);
      webSocketService.off('new_mining_problem', handleNewMiningProblem);
    };
  }, [gameId, userId]);

  // Función para abrir un problema (notificar al servidor)
  const openProblem = (blockId) => {
    console.log(`[SIMPLE-MINING] Abriendo problema: blockId=${blockId}`);
    
    if (!blockId || !userId) {
      console.error('❌ blockId o userId requerido para openProblem');
      return;
    }

    const webSocketService = getWebSocketService();
    if (!webSocketService.isConnected) {
      console.warn('⚠️ WebSocket no está conectado, esperando conexión...');
      // Esperar a que el WebSocket se conecte
      const checkConnection = () => {
        if (webSocketService.isConnected) {
          console.log('✅ WebSocket conectado, enviando problem-open');
          webSocketService.emit('mining:problem-open', { blockId, userId });
        } else {
          // Reintentar después de 500ms
          setTimeout(checkConnection, 500);
        }
      };
      checkConnection();
      return;
    }

    // Emitir evento al servidor
    console.log(`📡 [SIMPLEMINING] Enviando mining:problem-open: blockId=${blockId}, userId=${userId}`);
    webSocketService.emit('mining:problem-open', { blockId, userId });
  };

  // Listener para ACK de problem-open
  useEffect(() => {
    if (!gameId || !userId) return;

    const handleProblemOpenAck = (data) => {
      console.log(`[SIMPLE-MINING] ACK recibido:`, data);
      const { blockId, viewStart, isFirst, serverTime } = data;
      
      if (isFirst) {
        console.log(`[UI][MINING][ACK] problem=${blockId} viewStart=${viewStart} serverTime=${serverTime}`);
        setProblemViewStarts(prev => new Map(prev).set(blockId, viewStart));
        setCurrentBlockId(blockId);
        setCurrentViewStart(viewStart);
        
        // Emitir evento para sincronización del cronómetro visual
        webSocketService.emit('mining:sync-timer', {
          blockId,
          viewStart,
          serverTime,
          clientTime: Date.now()
        });
      }
    };

    const webSocketService = getWebSocketService();
    webSocketService.on('mining:problem-open:ack', handleProblemOpenAck);

    // Listener para actualizaciones de bloque en tiempo real
    const handleBlockUpdate = (data) => {
      console.log('📊 [SIMPLEMINING] Actualización de bloque recibida:', data);
      // Aquí podrías actualizar el estado local si necesitas mostrar standings en tiempo real
    };

    webSocketService.on('mining:block-update', handleBlockUpdate);

    return () => {
      const webSocketService = getWebSocketService();
      webSocketService.off('mining:problem-open:ack', handleProblemOpenAck);
      webSocketService.off('mining:block-update', handleBlockUpdate);
    };
  }, [gameId, userId]);

  const value = {
    pendingCount,
    requestPendingCount,
    openProblem,
    currentBlockId,
    currentViewStart,
    problemViewStarts
  };

  return (
    <SimpleMiningContext.Provider value={value}>
      {children}
    </SimpleMiningContext.Provider>
  );
};

export const useSimpleMiningContext = () => {
  const context = useContext(SimpleMiningContext);
  if (!context) {
    throw new Error('useSimpleMiningContext debe ser usado dentro de SimpleMiningProvider');
  }
  return context;
};
