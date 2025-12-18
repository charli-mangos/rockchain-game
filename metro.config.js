const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// Añadir soporte para archivos .cjs
defaultConfig.resolver.sourceExts.push('cjs');

// Deshabilitar exports de paquetes para evitar problemas con auth
defaultConfig.resolver.unstable_enablePackageExports = false;

// Excluir directorios innecesarios del bundling para acelerar el build
// Estos directorios no son necesarios en la app móvil
const projectRoot = __dirname;
defaultConfig.watchFolders = [projectRoot];

// Configurar resolver para excluir directorios específicos
defaultConfig.resolver = {
  ...defaultConfig.resolver,
  blockList: [
    // Excluir el directorio del servidor (no necesario en la app móvil)
    new RegExp(path.join(projectRoot, 'server').replace(/\\/g, '/') + '.*'),
    // Excluir funciones de Firebase (se despliegan por separado)
    new RegExp(path.join(projectRoot, 'functions').replace(/\\/g, '/') + '.*'),
  ],
};

module.exports = defaultConfig; 