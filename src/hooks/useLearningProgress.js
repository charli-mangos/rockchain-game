import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEARNING_PROGRESS_KEY = 'rockchain_learning_progress';

// Definir los logros y niveles de aprendizaje
export const LEARNING_ACHIEVEMENTS = {
  // Logros de blockchain
  first_block_mined: {
    id: 'first_block_mined',
    title: 'First Block Mined',
    description: 'Successfully mined your first block',
    category: 'blockchain',
    points: 10,
    icon: 'hammer',
    color: '#4CAF50'
  },
  mining_master: {
    id: 'mining_master',
    title: 'Mining Master',
    description: 'Mined 10 blocks successfully',
    category: 'blockchain',
    points: 50,
    icon: 'trophy',
    color: '#FF9800',
    requirement: { type: 'blocks_mined', count: 10 }
  },
  blockchain_explorer: {
    id: 'blockchain_explorer',
    title: 'Blockchain Explorer',
    description: 'Completed all blockchain tutorials',
    category: 'blockchain',
    points: 30,
    icon: 'globe',
    color: '#2196F3'
  },
  
  // Logros de economía circular
  first_waste_reduction: {
    id: 'first_waste_reduction',
    title: 'First Waste Reduction',
    description: 'Successfully reduced waste for the first time',
    category: 'circular_economy',
    points: 10,
    icon: 'leaf',
    color: '#2E7D32'
  },
  waste_warrior: {
    id: 'waste_warrior',
    title: 'Waste Warrior',
    description: 'Reduced 100 units of waste',
    category: 'circular_economy',
    points: 40,
    icon: 'leaf',
    color: '#4CAF50',
    requirement: { type: 'waste_reduced', count: 100 }
  },
  industry_expert: {
    id: 'industry_expert',
    title: 'Industry Expert',
    description: 'Selected the correct industry 5 times',
    category: 'circular_economy',
    points: 35,
    icon: 'business',
    color: '#FF9800',
    requirement: { type: 'correct_industry_selections', count: 5 }
  },
  
  // Logros de juego
  first_transaction: {
    id: 'first_transaction',
    title: 'First Transaction',
    description: 'Completed your first transaction',
    category: 'gameplay',
    points: 5,
    icon: 'repeat',
    color: '#2196F3'
  },
  rockcoin_collector: {
    id: 'rockcoin_collector',
    title: 'RockCoin Collector',
    description: 'Earned 500 RockCoins',
    category: 'gameplay',
    points: 25,
    icon: 'diamond',
    color: '#9C27B0',
    requirement: { type: 'rockcoins_earned', count: 500 }
  },
  game_master: {
    id: 'game_master',
    title: 'Game Master',
    description: 'Completed 10 full games',
    category: 'gameplay',
    points: 100,
    icon: 'star',
    color: '#FFD700',
    requirement: { type: 'games_completed', count: 10 }
  }
};

export const LEARNING_LEVELS = [
  { level: 1, name: 'Novice', minPoints: 0, color: '#9E9E9E' },
  { level: 2, name: 'Apprentice', minPoints: 50, color: '#4CAF50' },
  { level: 3, name: 'Expert', minPoints: 150, color: '#2196F3' },
  { level: 4, name: 'Master', minPoints: 300, color: '#FF9800' },
  { level: 5, name: 'Grandmaster', minPoints: 500, color: '#9C27B0' }
];

export const useLearningProgress = (userId) => {
  const [progress, setProgress] = useState({
    totalPoints: 0,
    level: 1,
    achievements: [],
    stats: {
      blocksMined: 0,
      wasteReduced: 0,
      correctIndustrySelections: 0,
      rockcoinsEarned: 0,
      gamesCompleted: 0,
      transactionsCompleted: 0
    }
  });
  const [newAchievements, setNewAchievements] = useState([]);

  // Cargar progreso al inicializar
  useEffect(() => {
    loadProgress();
  }, [userId]);

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem(`${LEARNING_PROGRESS_KEY}_${userId}`);
      if (stored) {
        const savedProgress = JSON.parse(stored);
        setProgress(savedProgress);
      }
    } catch (error) {
      console.error('Error loading learning progress:', error);
    }
  };

  const saveProgress = async (newProgress) => {
    try {
      await AsyncStorage.setItem(
        `${LEARNING_PROGRESS_KEY}_${userId}`,
        JSON.stringify(newProgress)
      );
    } catch (error) {
      console.error('Error saving learning progress:', error);
    }
  };

  const calculateLevel = (points) => {
    for (let i = LEARNING_LEVELS.length - 1; i >= 0; i--) {
      if (points >= LEARNING_LEVELS[i].minPoints) {
        return LEARNING_LEVELS[i];
      }
    }
    return LEARNING_LEVELS[0];
  };

  const checkAchievements = useCallback((newStats) => {
    const currentAchievements = progress.achievements || [];
    const newlyUnlocked = [];

    Object.values(LEARNING_ACHIEVEMENTS).forEach(achievement => {
      // Verificar si ya se tiene el logro
      if (currentAchievements.includes(achievement.id)) {
        return;
      }

      // Verificar si se cumple el requisito
      let isUnlocked = false;
      
      if (achievement.requirement) {
        const { type, count } = achievement.requirement;
        isUnlocked = newStats[type] >= count;
      } else {
        // Logros sin requisito específico (se desbloquean por eventos)
        isUnlocked = true;
      }

      if (isUnlocked) {
        newlyUnlocked.push(achievement);
      }
    });

    return newlyUnlocked;
  }, [progress.achievements]);

  const updateProgress = useCallback(async (updates) => {
    const newStats = { ...progress.stats, ...updates };
    const newAchievements = checkAchievements(newStats);
    
    // Agregar nuevos logros
    const updatedAchievements = [...(progress.achievements || [])];
    let totalPoints = progress.totalPoints;
    
    newAchievements.forEach(achievement => {
      updatedAchievements.push(achievement.id);
      totalPoints += achievement.points;
    });

    const newLevel = calculateLevel(totalPoints);
    
    const newProgress = {
      ...progress,
      totalPoints,
      level: newLevel.level,
      achievements: updatedAchievements,
      stats: newStats
    };

    setProgress(newProgress);
    setNewAchievements(newAchievements);
    await saveProgress(newProgress);

    return {
      newProgress,
      newAchievements,
      levelUp: newLevel.level > progress.level
    };
  }, [progress, checkAchievements]);

  // Funciones específicas para actualizar estadísticas
  const recordBlockMined = useCallback(() => {
    return updateProgress({ blocksMined: progress.stats.blocksMined + 1 });
  }, [updateProgress, progress.stats.blocksMined]);

  const recordWasteReduction = useCallback((amount) => {
    return updateProgress({ wasteReduced: progress.stats.wasteReduced + amount });
  }, [updateProgress, progress.stats.wasteReduced]);

  const recordCorrectIndustrySelection = useCallback(() => {
    return updateProgress({ correctIndustrySelections: progress.stats.correctIndustrySelections + 1 });
  }, [updateProgress, progress.stats.correctIndustrySelections]);

  const recordRockcoinsEarned = useCallback((amount) => {
    return updateProgress({ rockcoinsEarned: progress.stats.rockcoinsEarned + amount });
  }, [updateProgress, progress.stats.rockcoinsEarned]);

  const recordGameCompleted = useCallback(() => {
    return updateProgress({ gamesCompleted: progress.stats.gamesCompleted + 1 });
  }, [updateProgress, progress.stats.gamesCompleted]);

  const recordTransactionCompleted = useCallback(() => {
    return updateProgress({ transactionsCompleted: progress.stats.transactionsCompleted + 1 });
  }, [updateProgress, progress.stats.transactionsCompleted]);

  const getCurrentLevel = () => {
    return LEARNING_LEVELS.find(level => level.level === progress.level) || LEARNING_LEVELS[0];
  };

  const getNextLevel = () => {
    const currentIndex = LEARNING_LEVELS.findIndex(level => level.level === progress.level);
    return currentIndex < LEARNING_LEVELS.length - 1 ? LEARNING_LEVELS[currentIndex + 1] : null;
  };

  const getProgressToNextLevel = () => {
    const nextLevel = getNextLevel();
    if (!nextLevel) return { percentage: 100, pointsNeeded: 0 };
    
    const pointsNeeded = nextLevel.minPoints - progress.totalPoints;
    const totalPointsNeeded = nextLevel.minPoints - getCurrentLevel().minPoints;
    const percentage = Math.round(((progress.totalPoints - getCurrentLevel().minPoints) / totalPointsNeeded) * 100);
    
    return { percentage, pointsNeeded };
  };

  const getAchievementsByCategory = (category) => {
    return Object.values(LEARNING_ACHIEVEMENTS).filter(achievement => 
      achievement.category === category
    );
  };

  const getUnlockedAchievements = () => {
    return Object.values(LEARNING_ACHIEVEMENTS).filter(achievement =>
      progress.achievements.includes(achievement.id)
    );
  };

  const getLockedAchievements = () => {
    return Object.values(LEARNING_ACHIEVEMENTS).filter(achievement =>
      !progress.achievements.includes(achievement.id)
    );
  };

  const dismissNewAchievements = () => {
    setNewAchievements([]);
  };

  const resetProgress = async () => {
    const initialProgress = {
      totalPoints: 0,
      level: 1,
      achievements: [],
      stats: {
        blocksMined: 0,
        wasteReduced: 0,
        correctIndustrySelections: 0,
        rockcoinsEarned: 0,
        gamesCompleted: 0,
        transactionsCompleted: 0
      }
    };
    setProgress(initialProgress);
    setNewAchievements([]);
    await saveProgress(initialProgress);
  };

  return {
    // Estado
    progress,
    newAchievements,
    
    // Funciones de actualización
    updateProgress,
    recordBlockMined,
    recordWasteReduction,
    recordCorrectIndustrySelection,
    recordRockcoinsEarned,
    recordGameCompleted,
    recordTransactionCompleted,
    
    // Funciones de consulta
    getCurrentLevel,
    getNextLevel,
    getProgressToNextLevel,
    getAchievementsByCategory,
    getUnlockedAchievements,
    getLockedAchievements,
    
    // Utilidades
    dismissNewAchievements,
    resetProgress,
    
    // Constantes
    LEARNING_ACHIEVEMENTS,
    LEARNING_LEVELS
  };
};
