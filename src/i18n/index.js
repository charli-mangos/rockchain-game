import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Carga de recursos (simple: inline; ideal: importar JSONs)
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import hr from './locales/hr.json';
import ro from './locales/ro.json';

const STORAGE_KEY = 'app_lang';

export const supportedLngs = ['en', 'es', 'de', 'hr', 'ro'];
const fallbackLng = 'en';

export async function bootstrapI18n() {
  try {
    let lng = await AsyncStorage.getItem(STORAGE_KEY);

    if (!lng) {
      // detecta del dispositivo y normaliza
      const device = Localization.getLocales?.()[0]?.languageCode || 'en';
      lng = supportedLngs.includes(device) ? device : fallbackLng;
      await AsyncStorage.setItem(STORAGE_KEY, lng);
    }

    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        resources: { en: { translation: en }, es: { translation: es }, de: { translation: de }, hr: { translation: hr }, ro: { translation: ro } },
        lng,
        fallbackLng,
        supportedLngs,
        interpolation: { escapeValue: false },
        returnEmptyString: false,
        debug: false, // Desactivar debug para producción
        react: {
          useSuspense: false, // Evitar problemas de suspensión
        }
      });

    return i18n;
  } catch (error) {
    console.error('Error in bootstrapI18n:', error);
    // Fallback a inglés si hay error
    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        resources: { en: { translation: en } },
        lng: 'en',
        fallbackLng: 'en',
        supportedLngs: ['en'],
        interpolation: { escapeValue: false },
        returnEmptyString: false,
        debug: false,
        react: {
          useSuspense: false,
        }
      });
    return i18n;
  }
}

export async function changeLanguage(lng) {
  if (!supportedLngs.includes(lng)) return;
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(STORAGE_KEY, lng);
}

export default i18n;
