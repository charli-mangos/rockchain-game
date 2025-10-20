import React, { useContext, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import NavigationBar from '../components/NavigationBar';
import GameHeader from '../components/GameHeader';
import styles from '../styles/RecycleScreenStyles';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';

const RecycleScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { gameId, userId } = useGameContextHybridRobust();
  // Industrias que utilizan residuos de piedra natural para economía circular
  const industryData = {
    'Construction': {
      icon: 'construct',
      description: 'Building & Infrastructure',
      color: '#FF9800',
      wasteUsage: {
        description: 'Uses stone waste as aggregate for concrete and road construction',
        efficiency: 85, // % of waste that can be used
        examples: ['Concrete aggregate', 'Road base material', 'Drainage systems'],
        educationalMessage: 'The construction industry is the largest consumer of stone waste, using it to create stronger and more sustainable building materials.'
      }
    },
    'Technology': {
      icon: 'hardware-chip',
      description: 'Software & Hardware',
      color: '#2196F3',
      wasteUsage: {
        description: 'Uses stone dust in electronic components and manufacturing',
        efficiency: 60,
        examples: ['Electronic substrates', 'Manufacturing abrasives', 'Insulation materials'],
        educationalMessage: 'Technology companies use processed stone waste in electronic components and manufacturing processes, promoting circular economy.'
      }
    },
    'Healthcare': {
      icon: 'medical',
      description: 'Medical & Pharmaceutical',
      color: '#1d3d39',
      wasteUsage: {
        description: 'Uses purified stone materials in medical applications',
        efficiency: 40,
        examples: ['Surgical instruments', 'Dental materials', 'Pharmaceutical fillers'],
        educationalMessage: 'Healthcare industry uses specially processed stone waste in medical devices and pharmaceutical applications.'
      }
    },
    'Energy': {
      icon: 'flash',
      description: 'Power & Renewable Energy',
      color: '#FFC107',
      wasteUsage: {
        description: 'Uses stone waste in energy storage and generation systems',
        efficiency: 70,
        examples: ['Battery components', 'Solar panel substrates', 'Geothermal systems'],
        educationalMessage: 'Energy sector incorporates stone waste into renewable energy systems and energy storage solutions.'
      }
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
            {/* Nueva información educativa */}
            <View style={styles.efficiencyContainer}>
              <Text style={styles.efficiencyText}>
                Waste Efficiency: {industry.wasteUsage.efficiency}%
              </Text>
            </View>
            {isSelected && (
              <View style={styles.educationalInfo}>
                <Text style={styles.educationalDescription}>
                  {industry.wasteUsage.description}
                </Text>
                <Text style={styles.examplesTitle}>Examples:</Text>
                {industry.wasteUsage.examples.map((example, index) => (
                  <Text key={index} style={styles.exampleText}>
                    • {example}
                  </Text>
                ))}
              </View>
            )}
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
            title={t('recycle.title')}
            gameId={gameId} // Pasamos el gameId aquí
            userId={userId}
            onSettingsPress={() => console.log('Settings Pressed')}
        />      

        <View style={styles.questContainer}>
            <Text style={styles.questionText}>
                {t('recycle.selectIndustry')}
            </Text>
            <Text style={styles.text}>
                {t('recycle.chooseIndustry')}
            </Text>
            <Text style={styles.subText}>
                {t('recycle.winningIndustryRandom')}
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
