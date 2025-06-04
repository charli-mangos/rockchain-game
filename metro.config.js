const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Añadir soporte para archivos .cjs
defaultConfig.resolver.sourceExts.push('cjs');

// Deshabilitar exports de paquetes para evitar problemas con auth
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig; 