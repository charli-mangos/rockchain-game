import React, { useContext, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity } from 'react-native';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import NavigationBar from '../components/NavigationBar';
import GameHeader from '../components/GameHeader';
import styles from '../styles/RecycleScreenStyles';

const RecycleScreen = ({ navigation, route }) => {
  const { gameId, userId } = route.params;
  const industries = ['Pharmaceutical', 'Construction', 'Additive Manufacturing'];
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

  const renderOption = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.optionButton,
        selectedIndustry === item ? styles.selectedOption : null,
      ]}
      onPress={() => handleSelect(item)}
    >
      <Text
        style={[
          styles.optionText,
          selectedIndustry === item ? { color: '#fff' } : { color: '#000' },
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

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
                Choose the industry you want to invest your waste in.
            </Text>
            <Text style={styles.text}>
                The result will be a random selection each round. Good luck!
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
