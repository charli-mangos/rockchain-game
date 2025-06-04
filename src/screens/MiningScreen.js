import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { View, Text, TextInput, KeyboardAvoidingView, FlatList, TouchableOpacity } from 'react-native';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import RotatingCube from '../components/RotatingCube';
import { useGameContext } from '../context/GameContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import styles from '../styles/MiningScreenStyles';
import { usePlayerCount } from '../hooks/usePlayerCount';
import { useResponses } from '../hooks/useResponses';
import { useUserName } from "../hooks/useUserName";
import { useProductDetails } from '../hooks/useProductDetails';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const MiningScreen = ({ route, navigation }) => {
  const { gameId, userId } = route.params;
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
    setCurrentProblemIndex
  } = useGameContext();  
  const { responses, updateResponses } = useResponses(gameId, blockId);
  const [response, setResponse] = useState('');
  const [problemStartTime, setProblemStartTime] = useState(null);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [isLastBlock, setIsLastBlock] = useState(false);
  const totalPlayers = usePlayerCount(gameId);
  const userName = useUserName(userId);
  const activeProblem = miningProblems[currentProblemIndex]?.activeProblem || null;
  const blockId = miningProblems[currentProblemIndex]?.id || null;
  
  // Obtener el nombre del usuario que realizó la transacción
  const transactionUserName = useUserName(activeProblem?.transactionDetails?.userId);
  // Obtener los detalles del producto
  const productDetails = useProductDetails(activeProblem?.transactionDetails?.productId, gameId);

  // Efecto para inicializar el problema actual cuando se carga la pantalla
  useEffect(() => {
    if (activeProblem && !currentProblem && !hasRespondedToProblem(blockId)) {
      setProblemStartTime(Date.now());
      setResults(null);
      setCurrentProblem(activeProblem);
      setIsLastBlock(!hasMoreProblems());
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
      console.log("Missing data:", { response, blockId, currentProblem });
      return;
    }
  
    setIsWaiting(true);
    const submitMiningSolution = httpsCallable(functions, 'submitMiningSolution');
  
    try {
      const responseTime = Date.now() - problemStartTime;
      console.log('📝 Enviando respuesta:', {
        gameId,
        blockId,
        response: parseFloat(response),
        responseTime,
        userId,
        currentProblem
      });

      const result = await submitMiningSolution({
        gameId,
        blockId,
        response: parseFloat(response),
        responseTime,
        userId,
      });
  
      console.log('✅ Respuesta enviada exitosamente:', result.data);
      setResponse("");
      markProblemAsResponded(blockId);

      // Guardar la respuesta correcta antes de que el bloque se elimine
      setCorrectAnswer(currentProblem.solution);
      setCurrentBlockId(blockId);
      setCurrentTransactionUserName(transactionUserName);
      setCurrentProductDetails(productDetails);
      setCurrentTransactionType(currentProblem.transactionDetails?.type);

      // Esperar un momento para que Firestore se actualice
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Obtener las respuestas actualizadas directamente de Firestore
      console.log('🔍 Obteniendo respuestas actualizadas para el bloque:', blockId);
      const blockRef = doc(db, 'blockchain', gameId, 'blocks', blockId);
      const blockDoc = await getDoc(blockRef);
      const blockData = blockDoc.data();
      
      if (!blockData) {
        console.error('❌ No se encontraron datos del bloque:', blockId);
        setIsWaiting(false);
        return;
      }

      console.log('📄 Datos del bloque obtenidos:', blockData);
      const currentResponses = blockData.responses || [];
      
      // Enriquecer las respuestas con información de usuario
      console.log('👥 Enriqueciendo respuestas con información de usuario');
      const enrichedResponses = await Promise.all(
        currentResponses.map(async (res) => {
          const userDocRef = doc(db, 'users', res.userId);
          const userDoc = await getDoc(userDocRef);
          return {
            userName: userDoc.exists() ? userDoc.data().userName : "Unknown",
            isCorrect: parseFloat(res.response) === parseFloat(currentProblem.solution),
            ...res,
          };
        })
      );
  
      // Ordenar primero los correctos por tiempo, luego los incorrectos
      const sortedResponses = enrichedResponses.sort((a, b) => {
        if (a.isCorrect && !b.isCorrect) return -1;
        if (!a.isCorrect && b.isCorrect) return 1;
        if (a.isCorrect && b.isCorrect) return a.responseTime - b.responseTime;
        return 0;
      });

      console.log('📊 Respuestas ordenadas:', sortedResponses);
      setResults(sortedResponses);
      
      // Verificar si este era el último problema
      setIsLastBlock(!hasMoreProblems());
      
      // Decrementar la cola después de mostrar los resultados
      setTimeout(() => {
        decrementMiningQueue();
      }, 2000);
      
      setIsWaiting(false);
      
    } catch (error) {
      console.error("❌ Error submitting response:", {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        stack: error.stack
      });
      setIsWaiting(false);
    }
  };

  const handleNextProblem = () => {
    // Limpiar el estado actual
    setCurrentProblem(null);
    setResults(null);
    
    // Avanzar al siguiente problema
    nextProblem();
  };

  const handleExitMining = () => {
    // Limpiar el estado actual
    setCurrentProblem(null);
    setResults(null);
    
    // Volver a la pantalla anterior
    navigation.goBack();
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
    <PanGestureHandler
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
      activeOffsetX={[-10, 10]}
      enabled={!isWaiting && !results}
      minVelocity={0.3}
      shouldActivateOnStart={true}
      hitSlop={{ left: -10, right: -10 }}
    >
      <View style={styles.container}>
        <GameHeader title="RockMining" gameId={gameId} userId={userId} />

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
          ) : currentProblem ? (
            <View style={styles.problemContainer}>
              <View style={styles.blockInfoContainer}>
                <Text style={styles.blockInfoText}>Block {blockId.split('-')[1]}</Text>
                <Text style={styles.transactionInfoText}>
                  {transactionUserName} {currentProblem.transactionDetails?.type} {(productDetails?.description || 'Loading...').toLowerCase()}
                </Text>
              </View>
              
              <View style={styles.mathContainer}>
                <Text style={styles.problemText}>{currentProblem.mathProblem}</Text>
                <TextInput
                  style={styles.input}
                  value={response}
                  onChangeText={setResponse}
                  placeholder="Your answer"
                  keyboardType="numeric"
                />
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
              <Text style={styles.waitingText}>Loading problem...</Text>
            </View>
          )}
        </KeyboardAvoidingView>

        {!results && !isWaiting && miningProblems.length > 0 && (
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
  );
};

export default MiningScreen;