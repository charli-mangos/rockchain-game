import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeTranslation } from '../hooks/useSafeTranslation';
import { changeLanguage, supportedLngs } from '../i18n';

const labels = { en: 'EN', es: 'ES', de: 'DE', hr: 'HR', ro: 'RO' };

// Banderas nacionales con colores sutiles y naturales
const flagGradients = {
  en: {
    // Reino Unido - Cruz de San Jorge (cruz roja suave sobre fondo blanco)
    colors: ['#F5F5F5', '#C89595', '#F5F5F5'],
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: '#2C2C2C',
    borderColor: '#B89595'
  },
  es: {
    // España - Rojo suave con amarillo pastel
    colors: ['#B85450', '#F4E4BC', '#B85450'],
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: '#2C2C2C',
    borderColor: '#A04440'
  },
  de: {
    // Alemania - Gris suave, beige, amarillo pastel
    colors: ['#6A6A6A', '#C4A484', '#F0E68C'],
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: '#2C2C2C',
    borderColor: '#404040'
  },
  hr: {
    // Croacia - Rojo suave, blanco, azul suave
    colors: ['#D4A5A5', '#F5F5F5', '#A5B5D4'],
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: '#2C2C2C',
    borderColor: '#C49595'
  },
  ro: {
    // Rumania - Azul suave, amarillo pastel, rojo suave
    colors: ['#6B8FA5', '#F0E68C', '#D4A5A5'],
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: '#2C2C2C',
    borderColor: '#5A7F95'
  }
};

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useSafeTranslation();

  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {supportedLngs.map((lng) => {
        const isSelected = i18n.language === lng;
        const flagConfig = flagGradients[lng];
        
        return (
          <TouchableOpacity
            key={lng}
            onPress={() => changeLanguage(lng)}
            style={{
              borderRadius: 8,
              borderWidth: 2,
              borderColor: isSelected ? flagConfig.borderColor : '#ddd',
              minWidth: 40,
              alignItems: 'center',
              shadowColor: isSelected ? flagConfig.borderColor : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isSelected ? 0.3 : 0,
              shadowRadius: 2,
              elevation: isSelected ? 2 : 0,
              overflow: 'hidden'
            }}
          >
            {isSelected ? (
              <LinearGradient
                colors={flagConfig.colors}
                locations={flagConfig.locations}
                start={flagConfig.start}
                end={flagConfig.end}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  minWidth: 40,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Text style={{ 
                  fontWeight: '700',
                  fontSize: 12,
                  color: flagConfig.textColor,
                  textShadowColor: 'rgba(0,0,0,0.2)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 1
                }}>
                  {labels[lng]}
                </Text>
              </LinearGradient>
            ) : (
              <View style={{
                paddingVertical: 6,
                paddingHorizontal: 8,
                backgroundColor: '#fff',
                minWidth: 40,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ 
                  fontWeight: '500',
                  fontSize: 12,
                  color: '#666'
                }}>
                  {labels[lng]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
