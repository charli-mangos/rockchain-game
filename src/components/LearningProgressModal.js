import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ProgressBarAndroid,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const LearningProgressModal = ({ visible, onClose, learningProgress }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  if (!learningProgress) return null;

  const { progress, getCurrentLevel, getNextLevel, getProgressToNextLevel, getUnlockedAchievements, getLockedAchievements } = learningProgress;
  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  const progressToNext = getProgressToNextLevel();

  const renderOverview = () => (
    <View style={styles.tabContent}>
      <View style={styles.levelContainer}>
        <View style={[styles.levelBadge, { backgroundColor: currentLevel.color }]}>
          <Text style={styles.levelNumber}>{currentLevel.level}</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={styles.levelName}>{currentLevel.name}</Text>
          <Text style={styles.levelPoints}>{progress.totalPoints} points</Text>
        </View>
      </View>

      {nextLevel && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>
            Progress to {nextLevel.name}
          </Text>
          <View style={styles.progressBarContainer}>
            {Platform.OS === 'android' ? (
              <ProgressBarAndroid
                styleAttr="Horizontal"
                indeterminate={false}
                progress={progressToNext.percentage / 100}
                color={nextLevel.color}
                style={styles.progressBar}
              />
            ) : (
              <View style={[styles.progressBar, { backgroundColor: '#e0e0e0' }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${progressToNext.percentage}%`,
                      backgroundColor: nextLevel.color
                    }
                  ]} 
                />
              </View>
            )}
            <Text style={styles.progressText}>
              {progressToNext.pointsNeeded} points to next level
            </Text>
          </View>
        </View>
      )}

      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Your Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="hammer" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>{progress.stats.blocksMined}</Text>
            <Text style={styles.statLabel}>Blocks Mined</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="leaf" size={24} color="#2E7D32" />
            <Text style={styles.statNumber}>{progress.stats.wasteReduced}</Text>
            <Text style={styles.statLabel}>Waste Reduced</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="business" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{progress.stats.correctIndustrySelections}</Text>
            <Text style={styles.statLabel}>Correct Industries</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="diamond" size={24} color="#9C27B0" />
            <Text style={styles.statNumber}>{progress.stats.rockcoinsEarned}</Text>
            <Text style={styles.statLabel}>RockCoins Earned</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAchievements = () => {
    const unlockedAchievements = getUnlockedAchievements();
    const lockedAchievements = getLockedAchievements();

    return (
      <View style={styles.tabContent}>
        <Text style={styles.achievementsTitle}>
          Achievements ({unlockedAchievements.length}/{unlockedAchievements.length + lockedAchievements.length})
        </Text>
        
        <ScrollView style={styles.achievementsList} showsVerticalScrollIndicator={false}>
          {unlockedAchievements.map((achievement) => (
            <View key={achievement.id} style={[styles.achievementItem, styles.unlockedAchievement]}>
              <View style={[styles.achievementIcon, { backgroundColor: achievement.color }]}>
                <Ionicons name={achievement.icon} size={24} color="#fff" />
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
                <Text style={styles.achievementPoints}>+{achievement.points} points</Text>
              </View>
            </View>
          ))}
          
          {lockedAchievements.map((achievement) => (
            <View key={achievement.id} style={[styles.achievementItem, styles.lockedAchievement]}>
              <View style={[styles.achievementIcon, { backgroundColor: '#ccc' }]}>
                <Ionicons name={achievement.icon} size={24} color="#666" />
              </View>
              <View style={styles.achievementInfo}>
                <Text style={[styles.achievementTitle, styles.lockedText]}>{achievement.title}</Text>
                <Text style={[styles.achievementDescription, styles.lockedText]}>{achievement.description}</Text>
                <Text style={styles.achievementPoints}>+{achievement.points} points</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Learning Progress</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1d3d39" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
              onPress={() => setActiveTab('achievements')}
            >
              <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>
                Achievements
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'overview' ? renderOverview() : renderAchievements()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1d3d39',
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1d3d39',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#1d3d39',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  levelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 4,
  },
  levelPoints: {
    fontSize: 16,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressLabel: {
    fontSize: 16,
    color: '#1d3d39',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 16,
  },
  achievementsList: {
    flex: 1,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  unlockedAchievement: {
    backgroundColor: '#f8f9fa',
  },
  lockedAchievement: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  achievementPoints: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  lockedText: {
    color: '#999',
  },
});

export default LearningProgressModal;
