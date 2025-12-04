import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, TouchableWithoutFeedback } from 'react-native';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db, functions, auth } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { useSimpleMiningContext } from '../context/SimpleMiningContext';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';
import styles from '../styles/MiningScreenStyles';
import GameHeader from '../components/GameHeader';
import CustomNumericKeyboard from '../components/CustomNumericKeyboard';
import NavigationBar from '../components/NavigationBar';
import RotatingCube from '../components/RotatingCube';
import SimpleUnifiedTimer from '../components/SimpleUnifiedTimer';
import { usePlayerCount } from '../hooks/usePlayerCount';
import { useResponses } from '../hooks/useResponses';
import { useUserName } from "../hooks/useUserName";
import { useProductDetails } from '../hooks/useProductDetails';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const MiningScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { gameId, userId } = useGameContextHybridRobust();
  const { 
    miningProblems, 
    localPendingProblems,
    miningQueue,
    currentProblemIndex, 
    nextProblem,
    hasMoreProblems,
    hasRespondedToProblem,
    markProblemAsResponded,
    getNextAvailableProblem,
    setCurrentProblemIndex,
    decrementMiningQueue, 
    setShowMiningBubble,
    isWaiting,
    setIsWaiting,
    results,
    setResults,
    setCorrectAnswer,
    setCurrentBlockId,
    setCurrentTransactionUserName,
    setCurrentProductDetails,
    setCurrentTransactionType
  } = useGameContextHybridRobust();
  
  const { openProblem, currentViewStart, requestPendingCount } = useSimpleMiningContext();  
  const blockId = localPendingProblems[currentProblemIndex]?.id || null;
  const { responses, updateResponses } = useResponses(gameId, blockId);
  const [response, setResponse] = useState('');
  const [currentProblem, setCurrentProblem] = useState(null);
  const [isLastBlock, setIsLastBlock] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false); // Nuevo estado para controlar la visibilidad del teclado
  const [isExiting, setIsExiting] = useState(false);
  const [currentTimerTime, setCurrentTimerTime] = useState(0); // Tiempo actual del cronómetro unificado
  const totalPlayers = usePlayerCount(gameId);
  const userName = useUserName(userId);
  const activeProblem = localPendingProblems[currentProblemIndex]?.activeProblem || null;
  
  // Logs para debugging
  useEffect(() => {
    // Si estamos saliendo, no hacer nada
    if (isExiting) {
      console.log('🚪 Saliendo del minado, no ejecutando logs de debug...');
      return;
    }
    
    console.log(`🔍 MiningScreen Debug - blockId: ${blockId}, currentProblem: ${!!currentProblem}, activeProblem: ${!!activeProblem}`);
    console.log(`🔍 MiningScreen Debug - miningProblems.length: ${miningProblems.length}, currentProblemIndex: ${currentProblemIndex}`);
  }, [blockId, currentProblem, activeProblem, miningProblems.length, currentProblemIndex, isExiting]);
  
  // Función segura para obtener el número de bloque (usando índice como en BlockchainComponent)
  const getBlockNumber = () => {
    // Usar el índice actual + 1, igual que en BlockchainComponent
    return currentProblemIndex + 1;
  };

  // Función para actualizar el tiempo del cronómetro unificado
  const updateTimerTime = (time) => {
    setCurrentTimerTime(time);
  };

  // Función para formatear el tiempo en formato mm:ss
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Verificar si tenemos datos válidos para renderizar
  const hasValidData = blockId && currentProblem && activeProblem;
  
  // Logs de debugging para hasValidData (solo cuando cambia)
  if (hasValidData && !results) {
    // console.log(`🔍 hasValidData check:`, {
    //   blockId: !!blockId,
    //   currentProblem: !!currentProblem,
    //   activeProblem: !!activeProblem,
    //   hasValidData,
    //   blockIdValue: blockId,
    //   currentProblemId: currentProblem?.id,
    //   activeProblemId: activeProblem?.blockId
    // });
  }
  
  // Obtener el nombre del usuario que realizó la transacción
  const transactionUserName = useUserName(activeProblem?.transactionDetails?.userId);
  // Obtener los detalles del producto
  const productDetails = useProductDetails(activeProblem?.transactionDetails?.productId, gameId);
  const safeTransactionName = transactionUserName || t('mining.unknown');
  
  // Determinar qué mostrar: siempre incluir tipo de transacción y tipo de bloque
  const transactionType = activeProblem?.transactionDetails?.type || '';
  const transactionTypeLower = transactionType.toLowerCase();
  
  // Obtener el tipo de bloque (productType o marbleType)
  let blockType = '';
  if (activeProblem?.transactionDetails?.productType) {
    blockType = activeProblem.transactionDetails.productType.toLowerCase();
  } else if (activeProblem?.transactionDetails?.marbleType) {
    blockType = activeProblem.transactionDetails.marbleType.toLowerCase();
  } else if (productDetails?.description) {
    // Si no hay productType, usar la descripción del producto
    blockType = productDetails.description.toLowerCase();
  } else {
    blockType = 'block';
  }
  
  // Combinar tipo de transacción con el tipo de bloque
  const formattedProductDescription = transactionType 
    ? `${transactionTypeLower} ${blockType}`
    : blockType;
  const queueLabel = t('mining.queueLabel');
  const playersLabel = t('mining.playersMining');

  // EFECTO UNIFICADO: Manejar inicialización y limpieza de problemas
  useEffect(() => {
    console.log(`🔍 EFECTO UNIFICADO EJECUTÁNDOSE - Dependencias:`, {
      activeProblem: !!activeProblem,
      blockId,
      isExiting,
      results: !!results,
      activeProblemData: activeProblem ? { problem: activeProblem.problem, blockId: activeProblem.blockId } : null
    });
    
    // Si estamos saliendo, no hacer nada
    if (isExiting) {
      console.log('🚪 Saliendo del minado, no manejando problemas...');
      return;
    }
    
    // Si estamos mostrando resultados, no interferir
    if (results) {
      console.log('📊 Mostrando resultados, no ejecutando efecto de inicialización...');
      return;
    }
    
    console.log(`🔍 Efecto unificado - Estado actual:`, {
      activeProblem: !!activeProblem,
      currentProblem: !!currentProblem,
      blockId,
      currentProblemId: currentProblem?.id,
      hasResponded: hasRespondedToProblem(blockId),
      isExiting
    });
    
    // Si no hay blockId, no hacer nada
    if (!blockId) {
      console.log('⚠️ No hay blockId, esperando...');
      return;
    }
    
    // Si cambia el blockId, limpiar estado anterior PRIMERO
    if (blockId !== currentProblem?.id) {
      console.log(`🔄 Nuevo blockId detectado: ${blockId}, limpiando estado anterior...`);
      setResults(null);
      // NO limpiar currentProblem aquí, se limpiará en handleNextProblem o handleExitMining
      setIsWaiting(false);
      setResponse('');
      console.log('🧹 Estado limpiado para nuevo problema (manteniendo currentProblem para resultados)');
    }
    
    // Después de limpiar, inicializar el nuevo problema
    if (activeProblem && blockId) {
      
      // Solo inicializar si no hay currentProblem o si es un problema diferente
      if (!currentProblem || currentProblem.id !== blockId) {
        // Solo inicializar si no hay currentProblem o si es un problema diferente
        console.log(`✅ Inicializando nuevo problema - blockId: ${blockId}`);
        
        setResults(null);
        // Crear currentProblem con el id incluido
        setCurrentProblem({
          ...activeProblem,
          id: blockId
        });
        
        // Notificar al servidor que el usuario está viendo el problema (para registrar viewStart)
        if (blockId && userId) {
          console.log(`📡 Notificando al servidor que se está viendo el problema: ${blockId}`);
          openProblem(blockId);
        }
        // isLastBlock se actualizará automáticamente en el useEffect
      } else {
      }
    } else {
    }
    
    // FORZAR INICIALIZACIÓN si tenemos activeProblem pero no currentProblem (fallback)
    if (activeProblem && blockId && !currentProblem && !isExiting) {
      setCurrentProblem({
        ...activeProblem,
        id: blockId
      });
      setResults(null);
      // isLastBlock se actualizará automáticamente en el useEffect
    }
  }, [blockId, isExiting, results]);

  // Efecto para actualizar isLastBlock cuando cambia el estado de los problemas
  useEffect(() => {
    // Si estamos saliendo, no hacer nada
    if (isExiting) {
      console.log('🚪 Saliendo del minado, no actualizando isLastBlock...');
      return;
    }
    
    // Si estamos mostrando resultados, no actualizar isLastBlock
    if (results) {
      console.log('📊 Mostrando resultados, no actualizando isLastBlock...');
      return;
    }
    
    // Verificar si este es el último problema disponible en la cola local
    const hasMore = localPendingProblems.length > 1; // Más de 1 porque el actual cuenta
    setIsLastBlock(!hasMore);
    console.log(`⛏️ isLastBlock actualizado: ${!hasMore} (localPendingProblems: ${localPendingProblems.length})`);
  }, [localPendingProblems, isExiting, results]);

  // Efecto para mostrar/ocultar la burbuja de minado
  useEffect(() => {
    setShowMiningBubble(true);
    return () => {
      setShowMiningBubble(false);
    };
  }, [setShowMiningBubble]);

  // El cronómetro unificado maneja su propio tiempo y reset


  // Efecto para resetear isExiting cuando se monte el componente (entrada al minado)
  useEffect(() => {
    // Resetear isExiting cuando se entra al minado
    console.log('🚀 Entrando al minado, reseteando isExiting...');
    
    // Si estamos mostrando resultados, no interferir
    if (results) {
      console.log('📊 Mostrando resultados, no ajustando currentProblemIndex...');
      setIsExiting(false);
      return;
    }
    
    // Ajustar currentProblemIndex si es necesario
    if (localPendingProblems.length > 0) {
      const nextIndex = getNextAvailableProblem();
      if (nextIndex !== null && nextIndex !== currentProblemIndex) {
        setCurrentProblemIndex(nextIndex);
      }
    }
    
    // FORZAR INICIALIZACIÓN si tenemos activeProblem pero no currentProblem
    if (activeProblem && blockId && !currentProblem) {
      setCurrentProblem({
        ...activeProblem,
        id: blockId
      });
      setResults(null);
      // isLastBlock se actualizará automáticamente en el useEffect
    }
    
    setIsExiting(false);
  }, [localPendingProblems, results]);


  const handleSubmit = async () => {
    if (!response || !blockId || !currentProblem) {
      console.log("❌ Missing data for submission:", { 
        response: !!response, 
        blockId: !!blockId, 
        currentProblem: !!currentProblem,
        blockIdValue: blockId,
        responseValue: response
      });
      return;
    }
  
    // Validación adicional para blockId
    if (typeof blockId !== 'string' || blockId.trim() === '') {
      console.log("❌ Invalid blockId:", blockId);
      return;
    }
  
    // Ocultar el teclado al enviar la respuesta
    setShowKeyboard(false);
    
    console.log('🚀 Iniciando envío de respuesta de minado...');
    console.log('🔍 Estado de autenticación:', { 
      isAuthenticated: !!auth.currentUser, 
      userId: auth.currentUser?.uid,
      gameId,
      blockId 
    });
    // NO poner isWaiting a true aquí - queremos ver el problema mientras se procesa
    const submitMiningSolution = httpsCallable(functions, 'submitMiningSolution');
  
    try {
      // Usar el tiempo del cronómetro unificado como tiempo de respuesta
      const responseTime = currentTimerTime;
      console.log(`⏱️ Tiempo de respuesta del cronómetro unificado: ${responseTime}ms (${formatTime(responseTime)})`);
      const userResponse = parseFloat(response);
      const correctAnswer = parseFloat(currentProblem.solution);
      const isCorrect = userResponse === correctAnswer;
      
      console.log('📝 Procesando respuesta localmente:', {
        userResponse,
        correctAnswer,
        isCorrect,
        responseTime
      });

      // Guardar la respuesta correcta
      setCorrectAnswer(currentProblem.solution);
      setCurrentBlockId(blockId);
      setCurrentTransactionUserName(transactionUserName);
      setCurrentProductDetails(productDetails);
      setCurrentTransactionType(currentProblem.transactionDetails?.type);

      // Crear resultado local inmediato
      const localResult = {
        userName: userName || t('mining.unknown'),
        isCorrect: isCorrect,
        response: userResponse,
        responseTime: responseTime,
        userId: userId,
        timestamp: Date.now()
      };

      console.log('✅ Respuesta procesada localmente:', localResult);

      // NO limpiar la respuesta ni establecer results inmediatamente
      // Mantener el problema y la respuesta visibles mientras se procesa

      // AHORA procesar la respuesta (esto puede cambiar localPendingProblems)
      await markProblemAsResponded(blockId);

      // Solicitar problemas pendientes actualizados para actualizar la notificación
      const webSocketService = getWebSocketService();
      if (webSocketService.isConnected && requestPendingCount) {
        setTimeout(() => {
          requestPendingCount();
        }, 500);
      }

      // NO actualizar currentProblemIndex aquí - se hará cuando el usuario haga clic en "Next Block"
      // Solo verificar si hay más problemas para mostrar el botón correcto
      const hasMore = getNextAvailableProblem() !== null;
      if (!hasMore) {
        setIsLastBlock(true);
        
        // Si no hay más problemas, limpiar miningQueue en el servidor y resetear timestamp
        const webSocketService = getWebSocketService();
        if (webSocketService.isConnected && webSocketService.socket) {
          console.log('🧹 Último problema respondido, limpiando miningQueue...');
          webSocketService.socket.emit('clear_mining_queue', {
            gameId,
            userId
          });
        }
      } else {
        // console.log(`⏭️ Hay más problemas disponibles, se mostrará botón "Next Block"`);
        setIsLastBlock(false);
      }

      // Ahora mostrar los resultados y limpiar la respuesta
      setResults([localResult]);
      setResponse("");

      // Enviar respuesta vía WebSocket (tiempo real, sin interferir con otros)
      console.log('📞 Enviando respuesta vía WebSocket...', {
        gameId,
        blockId,
        response: userResponse,
        responseTime,
        userId,
        isCorrect: isCorrect
      });
      
      try {
        // Verificar que WebSocket esté conectado
        const webSocketService = getWebSocketService();
        if (!webSocketService.isConnected) {
          console.log('⚠️ WebSocket no conectado, intentando conectar...');
          await webSocketService.connect();
        }
        
        // Enviar vía WebSocket usando el nuevo sistema
        if (webSocketService.socket) {
          webSocketService.socket.emit('mining:submit', {
            blockId,
            userId,
            response: userResponse,
            userName: userName || t('mining.unknown'),
            responseTime: responseTime
          });
          
          console.log('✅ Respuesta enviada vía WebSocket');
        }
      } catch (error) {
        console.error('❌ Error enviando respuesta vía WebSocket:', error);
        // No fallar si WebSocket falla, ya mostramos el resultado local
      }

      console.log('📊 Resultado local mostrado:', localResult);
      
      // Verificar si este era el último problema (se actualizará automáticamente en el useEffect)
      // setIsLastBlock se actualiza automáticamente cuando cambia localPendingProblems
      
      console.log('✅ Proceso de envío de respuesta completado');
      
    } catch (error) {
      console.error("❌ Error submitting response:", {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        stack: error.stack
      });
      
      // Mostrar alerta al usuario
      Alert.alert(
        t('common.error'),
        t('mining.couldNotSendResponse'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleNextProblem = () => {
    console.log('⛏️ Avanzando al siguiente problema...');
    
    // Limpiar el estado actual
    setCurrentProblem(null);
    setResults(null);
    setShowKeyboard(false); // Ocultar el teclado al cambiar de problema
    setResponse(''); // Limpiar la respuesta
    setCurrentTimerTime(0); // Resetear el tiempo del cronómetro unificado
    
    
    // Avanzar al siguiente problema disponible en la cola local
    const nextIndex = getNextAvailableProblem();
    if (nextIndex !== null) {
      console.log(`⛏️ Navegando al siguiente problema: índice ${nextIndex}`);
      setCurrentProblemIndex(nextIndex);
    } else {
      setIsLastBlock(true);
    }
  };

  const handleExitMining = () => {
    console.log('🚪 Saliendo del minado...');
    
    // LIMPIEZA COMPLETA: Poner la pantalla como nueva
    setCurrentProblem(null);
    setResults(null);
    setShowKeyboard(false);
    setResponse('');
    setIsWaiting(false);
    setCurrentTimerTime(0); // Resetear el tiempo del cronómetro unificado
    // NO resetear currentProblemIndex aquí, se ajustará automáticamente al entrar
    
    
    // Limpiar miningQueue en el servidor
    const webSocketService = getWebSocketService();
    if (webSocketService.isConnected && webSocketService.socket) {
      console.log('🧹 Enviando clear_mining_queue al servidor...');
      webSocketService.socket.emit('clear_mining_queue', {
        gameId,
        userId
      });
    }
    
    
    // NO marcar isExiting aquí, se resetea automáticamente al entrar
    
    // Simplemente navegar al MarketScreen
    navigation.navigate('Market');
  };

  // Función para mostrar el teclado
  const handleShowKeyboard = () => {
    setShowKeyboard(true);
  };

  // Función para ocultar el teclado
  const handleHideKeyboard = () => {
    setShowKeyboard(false);
  };

  // Función para manejar cambios en el valor del teclado
  const handleKeyboardChange = (newValue) => {
    setResponse(newValue);
  };

  const handleGestureEvent = (event) => {
    const { translationX } = event.nativeEvent;
    if (Math.abs(translationX) > 50) {
      if (translationX > 0) {
        // Navegar al problema anterior si hay uno disponible
        const prevIndex = currentProblemIndex - 1;
        if (prevIndex >= 0) {
          setCurrentProblemIndex(prevIndex);
        }
      } else if (translationX < 0) {
        // Navegar al siguiente problema si hay uno disponible
        nextProblem();
      }
    }
  };

  const handleGestureStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      handleGestureEvent(event);
    }
  };

  const renderResultItem = ({ item, index }) => {
    const isSelf = item.userId === userId;
    const isCorrect = item.isCorrect;

    return (
      <View
        style={[
          styles.resultItem,
          isSelf && styles.resultItemSelf,
          !isCorrect && styles.resultItemWrong
        ]}
      >
        <View style={styles.resultIndexBubble}>
          <Text style={styles.resultIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.userName}</Text>
          <Text style={[styles.resultTime, !isCorrect && styles.resultTimeDanger]}>
            {isCorrect ? `${(item.responseTime / 1000).toFixed(2)}s` : t('mining.wrong')}
          </Text>
        </View>
        {isSelf && <Ionicons name="sparkles-outline" size={20} color="#ba5d17" />}
      </View>
    );
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={handleHideKeyboard} accessible={false}>
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleGestureStateChange}
          activeOffsetX={[-10, 10]}
          enabled={!isWaiting && !results}
          minVelocity={0.3}
          shouldActivateOnStart={true}
          hitSlop={{ left: -10, right: -10 }}
        >
          <View style={styles.screenContainer}>
            <View style={styles.headerContainer}>
              <GameHeader title={t('mining.title')} gameId={gameId} userId={userId} currentScreen="RockMining" />
            </View>

            <KeyboardAvoidingView
              style={styles.body}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={styles.content}>
                {isWaiting ? (
                  <View style={styles.stateContainer}>
                    <RotatingCube size={80} color="#ba5d17" />
                    <Text style={styles.waitingTitle}>{t('mining.loadingResults')}</Text>
                    <Text style={styles.waitingSubtitle}>{t('common.loading')}</Text>
                  </View>
                ) : results && results.length > 0 && currentProblem ? (
                  <View style={styles.stateContainer}>
                    <View style={styles.resultsCard}>
                      <View style={styles.messageContainer}>
                        {results.find(r => r.userId === userId)?.isCorrect ? (
                          <>
                            <Text style={styles.congratsText}>{t('mining.congratulations', { name: userName })}</Text>
                            <Text style={styles.congratsSubText}>{t('mining.solvedCorrectly')}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.errorText}>{t('mining.notCorrect')}</Text>
                            <Text style={styles.errorSubText}>{t('mining.correctAnswer', { answer: currentProblem?.solution })}</Text>
                          </>
                        )}
                      </View>
                      <Text style={styles.resultsHeader}>{t('mining.results')}</Text>
                      <FlatList
                        data={results}
                        keyExtractor={(item) => item.userId}
                        renderItem={renderResultItem}
                        scrollEnabled={false}
                        contentContainerStyle={styles.resultsList}
                      />
                      {!isLastBlock && hasMoreProblems() ? (
                        <TouchableOpacity 
                          style={styles.nextBlockButton}
                          onPress={handleNextProblem}
                        >
                          <Text style={styles.nextBlockButtonText}>{t('mining.nextBlock')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={[styles.nextBlockButton, styles.exitButton]}
                          onPress={handleExitMining}
                        >
                          <Text style={styles.nextBlockButtonText}>{t('mining.exitMining')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : hasValidData ? (
                  <View style={[styles.problemWrapper, showKeyboard && styles.problemWrapperKeyboard]}>
                    <View style={styles.infoSection}>
                      <View style={styles.blockCard}>
                        <View style={styles.blockHeaderRow}>
                          <View style={styles.blockBadge}>
                            <Ionicons name="cube-outline" size={18} color="#1d3d39" />
                            <Text style={styles.blockBadgeText}>{t('mining.blockNumber', { number: getBlockNumber() })}</Text>
                          </View>
                          <View style={styles.timerSection}>
                            <Text style={styles.timerLabel}>{t('mining.timeElapsed')}</Text>
                            <SimpleUnifiedTimer 
                              blockId={blockId || 'loading'}
                              isActive={!results && !isExiting}
                              onTimeUpdate={updateTimerTime}
                            />
                          </View>
                        </View>
                        <Text style={styles.transactionInfoText}>
                          {t('mining.transactionBy', { name: safeTransactionName })}
                        </Text>
                        <Text style={styles.productInfoText}>
                          {formattedProductDescription}
                        </Text>
                      </View>

                      <View style={styles.metricsRow}>
                        <View style={styles.metricCard}>
                          <Ionicons name="people-outline" size={18} color="#1d3d39" />
                          <Text style={styles.metricLabel}>{playersLabel}</Text>
                          <Text style={styles.metricValue}>{totalPlayers || 0}</Text>
                        </View>
                        <View style={styles.metricCard}>
                          <Ionicons name="hammer-outline" size={18} color="#1d3d39" />
                          <Text style={styles.metricLabel}>{queueLabel}</Text>
                          <Text style={styles.metricValue}>{miningQueue}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.problemCard, showKeyboard && styles.problemCardKeyboard]}>
                      <Text style={styles.problemText}>{currentProblem.mathProblem}</Text>
                      
                      <View style={styles.answerContainer}>
                        <Text style={styles.answerLabel}>{t('mining.yourAnswer')}</Text>
                        <TouchableOpacity 
                          style={[styles.answerDisplay, showKeyboard && styles.answerDisplayActive]}
                          onPress={handleShowKeyboard}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.answerText}>
                            {response || '—'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.submitButton, isWaiting && styles.submitButtonDisabled]} 
                        onPress={handleSubmit} 
                        disabled={isWaiting}
                      >
                        <Ionicons name="flash-outline" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.submitButtonText}>{t('mining.submit')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.stateContainer}>
                    <RotatingCube size={80} color="#ba5d17" />
                    <Text style={styles.waitingTitle}>
                      {!blockId ? t('mining.loadingBlock') : !currentProblem ? t('mining.loadingProblem') : t('mining.preparingMining')}
                    </Text>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>

            {!results && !isWaiting && miningQueue > 0 && hasValidData && (
              <View style={styles.navigationButtons}>
                <TouchableOpacity 
                  onPress={() => {
                    const prevIndex = currentProblemIndex - 1;
                    if (prevIndex >= 0) {
                      setCurrentProblemIndex(prevIndex);
                    }
                  }} 
                  disabled={currentProblemIndex === 0}
                  style={[styles.navButton, currentProblemIndex === 0 && styles.navButtonDisabled]}
                >
                  <Ionicons name="chevron-back-circle-outline" size={48} color={currentProblemIndex === 0 ? '#cfd6d5' : '#19443c'} />
                </TouchableOpacity>

                <View style={styles.miningButtonContainer}>
                  <View style={styles.miningButton}>
                    <Text style={styles.miningButtonText}>{miningQueue}</Text>
                    <Ionicons name="hammer-outline" size={24} color="#19443c" />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={nextProblem} 
                  disabled={!hasMoreProblems()}
                  style={[styles.navButton, !hasMoreProblems() && styles.navButtonDisabled]}
                >
                  <Ionicons name="chevron-forward-circle-outline" size={48} color={!hasMoreProblems() ? '#cfd6d5' : '#19443c'} />
                </TouchableOpacity>
              </View>
            )}

            <NavigationBar navigation={navigation}/>
          </View>
        </PanGestureHandler>
      </TouchableWithoutFeedback>

      <Modal
        visible={showKeyboard}
        transparent={true}
        animationType="slide"
        onRequestClose={handleHideKeyboard}
      >
        <TouchableWithoutFeedback onPress={handleHideKeyboard}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.keyboardModal}>
                <CustomNumericKeyboard
                  value={response}
                  onChange={handleKeyboardChange}
                  style={styles.customKeyboard}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default MiningScreen;