import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, supportedLngs } from '../i18n';

const labels = { en: 'EN', es: 'ES', de: 'DE', hr: 'HR' };

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {supportedLngs.map((lng) => (
        <TouchableOpacity
          key={lng}
          onPress={() => changeLanguage(lng)}
          style={{
            paddingVertical: 6, 
            paddingHorizontal: 8, 
            borderRadius: 8,
            borderWidth: 1, 
            borderColor: i18n.language === lng ? '#4F46E5' : '#ccc',
            backgroundColor: i18n.language === lng ? '#EEF2FF' : '#fff',
            minWidth: 40,
            alignItems: 'center'
          }}
        >
          <Text style={{ 
            fontWeight: i18n.language === lng ? '700' : '500',
            fontSize: 12
          }}>
            {labels[lng]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
