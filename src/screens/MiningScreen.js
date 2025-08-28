import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList, TouchableWithoutFeedback } from 'react-native';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db, functions, auth } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { useGameContextHybrid } from '../context/GameContextHybrid';
import { callAuthenticatedFunction } from '../utils/authHelper';
import webSocketService from '../services/WebSocketService';
import styles from '../styles/MiningScreenStyles';
import GameHeader from '../components/GameHeader';
import CustomNumericKeyboard from '../components/CustomNumericKeyboard';
import NavigationBar from '../components/NavigationBar';
import RotatingCube from '../components/RotatingCube';
import { usePlayerCount } from '../hooks/usePlayerCount';
import { useResponses } from '../hooks/useResponses';
import { useUserName } from "../hooks/useUserName";
import { useProductDetails } from '../hooks/useProductDetails';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const MiningScreen = ({ route, navigation }) => {
  const { gameId, userId } = useGameContextHybrid();
  const { 
    miningProblems, 
    currentProblemIndex, 
    nextProblem,
    hasMoreProblems,
    hasRespondedToProblem,
    markProblemAsResponded,
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
    setCurrentTransactionType,
    setCurrentProblemIndex,
    getNextAvailableProblem
  } = useGameContextHybrid();  
  const { responses, updateResponses } = useResponses(gameId, blockId);
  const [response, setResponse] = useState('');
  const [problemStartTime, setProblemStartTime] = useState(null);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [isLastBlock, setIsLastBlock] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false); // Nuevo estado para controlar la visibilidad del teclado
  const totalPlayers = usePlayerCount(gameId);
  const userName = useUserName(userId);
  const activeProblem = miningProblems[currentProblemIndex]?.activeProblem || null;
  const blockId = miningProblems[currentProblemIndex]?.id || null;
  
  // Logs para debugging
  useEffect(() => {
    console.log(`🔍 MiningScreen Debug - blockId: ${blockId}, currentProblem: ${!!currentProblem}, activeProblem: ${!!activeProblem}`);
    console.log(`🔍 MiningScreen Debug - miningProblems.length: ${miningProblems.length}, currentProblemIndex: ${currentProblemIndex}`);
  }, [blockId, currentProblem, activeProblem, miningProblems.length, currentProblemIndex]);
  
  // Función segura para obtener el número de bloque
  const getBlockNumber = () => {
    if (!blockId || typeof blockId !== 'string') {
      console.log(`⚠️ getBlockNumber: blockId inválido - ${blockId}`);
      return '...';
    }
    const parts = blockId.split('-');
    const blockNumber = parts.length > 1 ? parts[1] : '...';
    console.log(`✅ getBlockNumber: ${blockNumber} (de ${blockId})`);
    return blockNumber;
  };
  
  // Verificar si tenemos datos válidos para renderizar
  const hasValidData = blockId && currentProblem && activeProblem;
  
  // Obtener el nombre del usuario que realizó la transacción
  const transactionUserName = useUserName(activeProblem?.transactionDetails?.userId);
  // Obtener los detalles del producto
  const productDetails = useProductDetails(activeProblem?.transactionDetails?.productId, gameId);

  // Efecto para inicializar el problema actual cuando se carga la pantalla
  useEffect(() => {
    if (activeProblem && !currentProblem && blockId && !hasRespondedToProblem(blockId)) {
      console.log(`✅ Inicializando nuevo problema - blockId: ${blockId}`);
      setProblemStartTime(Date.now());
      setResults(null);
      setCurrentProblem(activeProblem);
      setIsLastBlock(!hasMoreProblems());
    } else if (blockId && hasRespondedToProblem(blockId)) {
      console.log(`⚠️ Problema ${blockId} ya respondido, buscando siguiente...`);
      // Si el problema actual ya fue respondido, buscar el siguiente
      const nextIndex = getNextAvailableProblem();
      if (nextIndex !== null) {
        setCurrentProblemIndex(nextIndex);
      }
    }
  }, [activeProblem, currentProblem, blockId, hasRespondedToProblem, hasMoreProblems]);

  // Efecto para actualizar isLastBlock cuando cambia el estado de los problemas
  useEffect(() => {
    // Verificar si este es el último problema disponible
    setIsLastBlock(!hasMoreProblems());
  }, [hasMoreProblems, currentProblemIndex, miningProblems]);

  // Efecto para mostrar/ocultar la burbuja de minado
  useEffect(() => {
    setShowMiningBubble(true);
    return () => {
      setShowMiningBubble(false);
    };
  }, [setShowMiningBubble]);

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
    setIsWaiting(true);
    const submitMiningSolution = httpsCallable(functions, 'submitMiningSolution');
  
    try {
      const responseTime = Date.now() - problemStartTime;
      const userResponse = parseFloat(response);
      const correctAnswer = parseFloat(currentProblem.solution);
      const isCorrect = userResponse === correctAnswer;
      
      console.log('📝 Procesando respuesta localmente:', {
        userResponse,
        correctAnswer,
        isCorrect,
        responseTime
      });

      // Procesar la respuesta localmente primero
      setResponse("");
      await markProblemAsResponded(blockId);

      // Guardar la respuesta correcta
      setCorrectAnswer(currentProblem.solution);
      setCurrentBlockId(blockId);
      setCurrentTransactionUserName(transactionUserName);
      setCurrentProductDetails(productDetails);
      setCurrentTransactionType(currentProblem.transactionDetails?.type);

      // Crear resultado local inmediato
      const localResult = {
        userName: userName || "Unknown",
        isCorrect: isCorrect,
        response: userResponse,
        responseTime: responseTime,
        userId: userId,
        timestamp: Date.now()
      };

      console.log('✅ Respuesta procesada localmente:', localResult);

      // Mostrar resultado inmediato (solo la respuesta del jugador actual)
      setResults([localResult]);
      setIsWaiting(false);

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
        if (!webSocketService.isConnected) {
          console.log('⚠️ WebSocket no conectado, intentando conectar...');
          await webSocketService.connect();
        }
        
        // Enviar vía WebSocket
        webSocketService.socket.emit('submit_mining_response', {
          gameId,
          blockId,
          userId,
          userName: userName || "Unknown",
          response: userResponse,
          responseTime,
          isCorrect: isCorrect
        });
        
        console.log('✅ Respuesta enviada vía WebSocket');
      } catch (error) {
        console.error('❌ Error enviando respuesta vía WebSocket:', error);
        // No fallar si WebSocket falla, ya mostramos el resultado local
      }

      console.log('📊 Resultado local mostrado:', localResult);
      
      // Verificar si este era el último problema
      setIsLastBlock(!hasMoreProblems());
      
      setIsWaiting(false);
      console.log('✅ Proceso de envío de respuesta completado');
      
    } catch (error) {
      console.error("❌ Error submitting response:", {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        stack: error.stack
      });
      setIsWaiting(false);
      
      // Mostrar alerta al usuario
      Alert.alert(
        'Error',
        'No se pudo enviar la respuesta. Por favor, inténtalo de nuevo.',
        [{ text: 'OK' }]
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
    
    // Avanzar al siguiente problema
    nextProblem();
  };

  const handleExitMining = () => {
    console.log('🚪 Saliendo del minado...');
    
    // Limpiar el estado actual
    setCurrentProblem(null);
    setResults(null);
    setShowKeyboard(false); // Ocultar el teclado al salir
    setResponse(''); // Limpiar la respuesta
    setIsWaiting(false); // Asegurar que no esté en estado de espera
    
    // Navegar a GameTabs en lugar de goBack
    console.log('🎮 Navegando a GameTabs...');
    navigation.navigate('GameTabs');
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

  return (
    <View style={styles.container}>
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
          <View style={styles.mainContent}>
            <GameHeader title="RockMining" gameId={gameId} userId={userId} currentScreen="RockMining" />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              {isWaiting ? (
                <View style={styles.waitingContainer}>
                  <RotatingCube size={80} color="#000" /> 
                  <Text style={styles.waitingText}>Loading results...</Text>
                </View>
              ) : results ? (
                <View style={styles.resultsContainer}>
                  <View style={styles.messageContainer}>
                    {results.find(r => r.userId === userId)?.isCorrect ? (
                      <View>
                        <Text style={styles.congratsText}>Congratulations {userName}!</Text>
                        <Text style={styles.congratsText}>You solved the block correctly!</Text>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.errorText}>Not correct.</Text>
                        <Text style={styles.errorText}>The answer is: {currentProblem?.solution}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.resultsHeader}>Results</Text>
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.userId}
                    renderItem={({ item, index }) => (
                      <View style={styles.resultItem}>
                        <Text style={styles.resultText}>
                          {index + 1}. {item.userName} - {
                            item.isCorrect 
                              ? `${(item.responseTime / 1000).toFixed(2)}s`
                              : <Text style={styles.wrongText}>wrong</Text>
                          }
                        </Text>
                      </View>
                    )}
                    style={{ maxHeight: '50%', width: '100%' }}
                  />
                  {!isLastBlock ? (
                    <TouchableOpacity 
                      style={styles.nextBlockButton}
                      onPress={handleNextProblem}
                    >
                      <Text style={styles.nextBlockButtonText}>Next Block</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.nextBlockButton, { backgroundColor: '#e74c3c' }]}
                      onPress={handleExitMining}
                    >
                      <Text style={styles.nextBlockButtonText}>Exit Mining</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : miningProblems.length === 0 ? (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingText}>No mining problems available</Text>
                  <TouchableOpacity 
                    style={[styles.nextBlockButton, { backgroundColor: '#e74c3c' }]}
                    onPress={handleExitMining}
                  >
                    <Text style={styles.nextBlockButtonText}>Exit Mining</Text>
                  </TouchableOpacity>
                </View>
              ) : hasValidData ? (
                <View style={styles.problemContainer}>
                  <View style={styles.blockInfoContainer}>
                    <Text style={styles.blockInfoText}>Block {getBlockNumber()}</Text>
                    <Text style={styles.transactionInfoText}>
                      {transactionUserName} {currentProblem.transactionDetails?.type} {(productDetails?.description || 'Loading...').toLowerCase()}
                    </Text>
                  </View>
                  
                  <View style={styles.mathContainer}>
                    <Text style={styles.problemText}>{currentProblem.mathProblem}</Text>
                    
                    {/* Campo de respuesta clickeable */}
                    <View style={styles.answerContainer}>
                      <Text style={styles.answerLabel}>Your answer:</Text>
                      <TouchableOpacity 
                        style={[styles.answerDisplay, showKeyboard && styles.answerDisplayActive]}
                        onPress={handleShowKeyboard}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.answerText}>
                          {response || '0'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.submitButton, isWaiting && styles.submitButtonDisabled]} 
                      onPress={handleSubmit} 
                      disabled={isWaiting}
                    >
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <RotatingCube size={80} color="#000" />
                  <Text style={styles.waitingText}>
                    {!blockId ? 'Loading block...' : !currentProblem ? 'Loading problem...' : 'Preparing mining...'}
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>

            {!results && !isWaiting && miningProblems.length > 0 && hasValidData && (
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
                  <Ionicons name="chevron-back-circle-outline" size={50} color={currentProblemIndex === 0 ? 'gray' : 'black'} />
                </TouchableOpacity>

                <View style={styles.miningButtonContainer}>
                  <View style={styles.miningButton}>
                    <Text style={styles.miningButtonText}>{miningProblems.length}</Text>
                    <Ionicons name="hammer-outline" size={24} color="#000" />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={nextProblem} 
                  disabled={!hasMoreProblems()}
                  style={[styles.navButton, !hasMoreProblems() && styles.navButtonDisabled]}
                >
                  <Ionicons name="chevron-forward-circle-outline" size={50} color={!hasMoreProblems() ? 'gray' : 'black'} />
                </TouchableOpacity>
              </View>
            )}

            <NavigationBar navigation={navigation}/>
          </View>
        </PanGestureHandler>
      </TouchableWithoutFeedback>

      {/* Teclado personalizado usando Modal */}
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
    </View>
  );
};

export default MiningScreen;