import React, { useContext, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import NavigationBar from '../components/NavigationBar';
import GameHeader from '../components/GameHeader';
import styles from '../styles/RecycleScreenStyles';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';

const RecycleScreen = ({ navigation, route }) => {
  const { gameId, userId } = useGameContextHybridRobust();
  // Industrias que utilizan residuos físicos para waste management
  const industryData = {
    'Construction': {
      icon: 'construct',
      description: 'Building & Infrastructure',
      color: '#FF9800'
    },
    'Technology': {
      icon: 'hardware-chip',
      description: 'Software & Hardware',
      color: '#2196F3'
    },
    'Healthcare': {
      icon: 'medical',
      description: 'Medical & Pharmaceutical',
      color: '#1d3d39'
    },
    'Energy': {
      icon: 'flash',
      description: 'Power & Renewable Energy',
      color: '#FFC107'
    }
  };
  
  const industries = Object.keys(industryData);
  const [selectedIndustry, setSelectedIndustry] = useState(null);

  const handleSelect = async (industry) => {
    setSelectedIndustry(industry);
  
    try {
      const gameRef = doc(db, 'users', userId);
      await updateDoc(gameRef, {
        [`games.${gameId}.selectedIndustry`]: industry,
      });
      console.log(`Industry selected and saved for player ${userId}: ${industry}`);
    } catch (error) {
      console.error('Error saving selected industry:', error);
    }
  };

  const renderOption = ({ item }) => {
    const industry = industryData[item];
    const isSelected = selectedIndustry === item;
    
    return (
      <TouchableOpacity
        style={[
          styles.optionButton,
          isSelected ? [styles.selectedOption, { borderColor: industry.color }] : null,
        ]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.optionContent}>
          <View style={[styles.iconContainer, { backgroundColor: isSelected ? '#1d3d39' : '#f0f0f0' }]}>
            <Ionicons 
              name={industry.icon} 
              size={24} 
              color={isSelected ? '#fff' : industry.color} 
            />
          </View>
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.optionText,
                isSelected ? { color: '#1d3d39' } : { color: '#1d3d39' },
              ]}
            >
              {item}
            </Text>
            <Text
              style={[
                styles.optionDescription,
                isSelected ? { color: '#1d3d39' } : { color: '#1d3d39' },
              ]}
            >
              {industry.description}
            </Text>
          </View>
          {isSelected && (
            <Ionicons 
              name="checkmark-circle" 
              size={24} 
              color="#1d3d39" 
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
        <GameHeader
            title="RockWaste"
            gameId={gameId} // Pasamos el gameId aquí
            userId={userId}
            onSettingsPress={() => console.log('Settings Pressed')}
        />      

        <View style={styles.questContainer}>
            <Text style={styles.questionText}>
                Select the Recycling Industry
            </Text>
            <Text style={styles.text}>
                Choose which industry you think will win this round. If you guess correctly, your waste will be reduced.
            </Text>
            <Text style={styles.subText}>
                The winning industry is randomly selected each round. Good luck!
            </Text>
            <FlatList
                data={industries}
                renderItem={renderOption}
                keyExtractor={(item) => item}
                extraData={selectedIndustry}
            />
        </View>
        
        <NavigationBar navigation={navigation} />
    </View>
  );
};

export default RecycleScreen;
