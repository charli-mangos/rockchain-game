import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_STORAGE_KEY = 'rockchain_tutorials_completed';

// Definir los tutoriales disponibles
export const TUTORIALS = {
  blockchain_basics: {
    id: 'blockchain_basics',
    title: 'What is Blockchain?',
    icon: 'link',
    content: 'Blockchain is a digital ledger that records transactions in blocks. Each block is linked to the previous one, creating an unbreakable chain of information.',
    example: 'When you buy a product in RockChain, it creates a transaction that needs to be verified by miners before being added to the blockchain.',
    interactive: true,
    order: 1
  },
  mining_process: {
    id: 'mining_process',
    title: 'How Mining Works',
    icon: 'hammer',
    content: 'Miners solve mathematical problems to validate transactions and add them to the blockchain. This process secures the network and prevents fraud.',
    example: 'In RockChain, you solve simple math problems to simulate the mining process. The fastest correct answer wins the block!',
    interactive: true,
    order: 2
  },
  circular_economy: {
    id: 'circular_economy',
    title: 'Circular Economy in Stone Industry',
    icon: 'refresh',
    content: 'Stone waste can be reused by other industries, reducing environmental impact and creating economic value. This is called circular economy.',
    example: 'Construction industry uses stone waste as aggregate for concrete, while technology companies use it in electronic components.',
    interactive: true,
    order: 3
  },
  waste_management: {
    id: 'waste_management',
    title: 'Waste Management Strategy',
    icon: 'leaf',
    content: 'Different industries have different efficiency levels in reusing stone waste. Choose wisely to maximize your environmental and economic impact!',
    example: 'Construction industry has 85% efficiency, while Healthcare has 40%. Higher efficiency means more waste reduction and better rewards.',
    interactive: true,
    order: 4
  },
  game_mechanics: {
    id: 'game_mechanics',
    title: 'Game Mechanics',
    icon: 'game-controller',
    content: 'Buy products, mine blocks, and choose industries to reduce waste. Each action teaches you about blockchain and circular economy!',
    example: 'Complete transactions to generate mining problems, solve them to earn rewards, and select the right industry to maximize waste reduction.',
    interactive: true,
    order: 5
  }
};

export const useTutorial = (userId) => {
  const [completedTutorials, setCompletedTutorials] = useState(new Set());
  const [currentTutorial, setCurrentTutorial] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);

  // Cargar tutoriales completados al inicializar
  useEffect(() => {
    loadCompletedTutorials();
  }, [userId]);

  const loadCompletedTutorials = async () => {
    try {
      const stored = await AsyncStorage.getItem(`${TUTORIAL_STORAGE_KEY}_${userId}`);
      if (stored) {
        const completed = JSON.parse(stored);
        setCompletedTutorials(new Set(completed));
      }
    } catch (error) {
      console.error('Error loading completed tutorials:', error);
    }
  };

  const markTutorialCompleted = async (tutorialId) => {
    try {
      const newCompleted = new Set(completedTutorials);
      newCompleted.add(tutorialId);
      setCompletedTutorials(newCompleted);
      
      await AsyncStorage.setItem(
        `${TUTORIAL_STORAGE_KEY}_${userId}`,
        JSON.stringify([...newCompleted])
      );
    } catch (error) {
      console.error('Error saving completed tutorial:', error);
    }
  };

  const getNextTutorial = useCallback(() => {
    const sortedTutorials = Object.values(TUTORIALS).sort((a, b) => a.order - b.order);
    
    for (const tutorial of sortedTutorials) {
      if (!completedTutorials.has(tutorial.id)) {
        return tutorial;
      }
    }
    return null;
  }, [completedTutorials]);

  const startTutorial = (tutorialId = null) => {
    const tutorial = tutorialId ? TUTORIALS[tutorialId] : getNextTutorial();
    if (tutorial) {
      setCurrentTutorial(tutorial);
      setCurrentStep(0);
      setShowTutorial(true);
    }
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    setCurrentTutorial(null);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentTutorial) {
      if (currentStep === 0) {
        // Marcar como completado cuando se cierra
        markTutorialCompleted(currentTutorial.id);
        closeTutorial();
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const shouldShowTutorial = (tutorialId) => {
    return !completedTutorials.has(tutorialId);
  };

  const getTutorialProgress = () => {
    const total = Object.keys(TUTORIALS).length;
    const completed = completedTutorials.size;
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100)
    };
  };

  const resetTutorials = async () => {
    try {
      setCompletedTutorials(new Set());
      await AsyncStorage.removeItem(`${TUTORIAL_STORAGE_KEY}_${userId}`);
    } catch (error) {
      console.error('Error resetting tutorials:', error);
    }
  };

  return {
    // Estado
    currentTutorial,
    currentStep,
    showTutorial,
    completedTutorials,
    
    // Acciones
    startTutorial,
    closeTutorial,
    nextStep,
    previousStep,
    markTutorialCompleted,
    resetTutorials,
    
    // Utilidades
    shouldShowTutorial,
    getNextTutorial,
    getTutorialProgress,
    
    // Datos
    TUTORIALS
  };
};
