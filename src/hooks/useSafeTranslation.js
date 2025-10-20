import { useTranslation } from 'react-i18next';

// Hook personalizado para manejar traducciones con fallback a inglés
export const useSafeTranslation = () => {
  const { t, i18n } = useTranslation();

  // Función segura de traducción que siempre devuelve algo
  const safeT = (key, options = {}) => {
    try {
      // Si i18n no está inicializado, devolver la clave
      if (!i18n || !i18n.isInitialized) {
        return key;
      }

      const translation = t(key, options);
      
      // Si la traducción es la misma que la clave (no encontrada), devolver la clave
      if (translation === key) {
        return key;
      }

      return translation;
    } catch (error) {
      console.warn('Translation error for key:', key, error);
      return key;
    }
  };

  return {
    t: safeT,
    i18n,
    ready: i18n?.isInitialized || false
  };
};

export default useSafeTranslation;
