import { Dimensions, PixelRatio } from 'react-native';

// Obtener dimensiones de la pantalla
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tamaños de referencia (basados en un iPhone 12/13 estándar)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Calcular factores de escala
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

// Usar el menor de los dos para mantener proporciones
const scale = Math.min(widthScale, heightScale);

// Clasificación de dispositivos
const determineDeviceType = () => {
  const width = SCREEN_WIDTH;
  if (width < 360) return 'small'; // Teléfonos pequeños
  if (width < 414) return 'medium'; // Teléfonos estándar
  if (width < 768) return 'large'; // Teléfonos grandes
  return 'tablet'; // Tablets
};

const deviceType = determineDeviceType();

/**
 * Escala un tamaño basado en el ancho de la pantalla
 * @param {number} size - Tamaño base a escalar
 * @returns {number} - Tamaño escalado
 */
export const scaleWidth = (size) => {
  return Math.round(size * widthScale);
};

/**
 * Escala un tamaño basado en la altura de la pantalla
 * @param {number} size - Tamaño base a escalar
 * @returns {number} - Tamaño escalado
 */
export const scaleHeight = (size) => {
  return Math.round(size * heightScale);
};

/**
 * Escala un tamaño manteniendo proporciones (usa el menor factor)
 * @param {number} size - Tamaño base a escalar
 * @returns {number} - Tamaño escalado
 */
export const scaleSize = (size) => {
  return Math.round(size * scale);
};

/**
 * Escala un tamaño de fuente de forma más conservadora
 * @param {number} fontSize - Tamaño de fuente base
 * @returns {number} - Tamaño de fuente escalado
 */
export const scaleFont = (fontSize) => {
  const scaledSize = fontSize * scale;
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
};

/**
 * Escala un padding/margin de forma proporcional
 * @param {number} spacing - Espaciado base
 * @returns {number} - Espaciado escalado
 */
export const scaleSpacing = (spacing) => {
  return Math.round(spacing * scale);
};

/**
 * Obtiene un porcentaje del ancho de la pantalla
 * @param {number} percentage - Porcentaje (0-100)
 * @returns {number} - Ancho en píxeles
 */
export const widthPercentage = (percentage) => {
  return (SCREEN_WIDTH * percentage) / 100;
};

/**
 * Obtiene un porcentaje de la altura de la pantalla
 * @param {number} percentage - Porcentaje (0-100)
 * @returns {number} - Altura en píxeles
 */
export const heightPercentage = (percentage) => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

/**
 * Obtiene el tipo de dispositivo actual
 * @returns {string} - 'small' | 'medium' | 'large' | 'tablet'
 */
export const getDeviceType = () => deviceType;

/**
 * Verifica si el dispositivo es una tablet
 * @returns {boolean}
 */
export const isTablet = () => deviceType === 'tablet';

/**
 * Verifica si el dispositivo es pequeño
 * @returns {boolean}
 */
export const isSmallDevice = () => deviceType === 'small';

/**
 * Obtiene dimensiones de la pantalla
 * @returns {object} - { width, height }
 */
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
});

/**
 * Escala un tamaño de forma adaptativa según el tipo de dispositivo
 * @param {number} small - Tamaño para dispositivos pequeños
 * @param {number} medium - Tamaño para dispositivos medianos
 * @param {number} large - Tamaño para dispositivos grandes
 * @param {number} tablet - Tamaño para tablets
 * @returns {number} - Tamaño según el dispositivo
 */
export const adaptiveSize = (small, medium, large, tablet) => {
  switch (deviceType) {
    case 'small':
      return small;
    case 'medium':
      return medium;
    case 'large':
      return large;
    case 'tablet':
      return tablet;
    default:
      return medium;
  }
};

/**
 * Escala un tamaño de fuente de forma adaptativa
 * @param {number} small - Tamaño de fuente para dispositivos pequeños
 * @param {number} medium - Tamaño de fuente para dispositivos medianos
 * @param {number} large - Tamaño de fuente para dispositivos grandes
 * @param {number} tablet - Tamaño de fuente para tablets
 * @returns {number} - Tamaño de fuente según el dispositivo
 */
export const adaptiveFontSize = (small, medium, large, tablet) => {
  const size = adaptiveSize(small, medium, large, tablet);
  return scaleFont(size);
};

// Exportar valores constantes útiles
export const SCREEN_DIMENSIONS = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

export default {
  scaleWidth,
  scaleHeight,
  scaleSize,
  scaleFont,
  scaleSpacing,
  widthPercentage,
  heightPercentage,
  getDeviceType,
  isTablet,
  isSmallDevice,
  getScreenDimensions,
  adaptiveSize,
  adaptiveFontSize,
  SCREEN_DIMENSIONS,
};

