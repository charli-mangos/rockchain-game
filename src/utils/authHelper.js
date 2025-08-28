import { auth } from '../../firebase';

/**
 * Verifica que el usuario esté autenticado antes de hacer llamadas a Firebase Functions
 * @param {Function} functionCall - La función a ejecutar si el usuario está autenticado
 * @param {string} functionName - Nombre de la función para logging
 * @returns {Promise} - Resultado de la función o error de autenticación
 */
export const callAuthenticatedFunction = async (functionCall, functionName = 'Firebase Function') => {
  // Verificar que el usuario esté autenticado
  if (!auth.currentUser) {
    console.error(`❌ Usuario no autenticado al llamar a ${functionName}`);
    throw new Error('User must be authenticated to call this function');
  }

  console.log(`✅ Usuario autenticado (${auth.currentUser.uid}) llamando a ${functionName}`);
  
  try {
    const result = await functionCall();
    console.log(`✅ ${functionName} ejecutada exitosamente`);
    return result;
  } catch (error) {
    console.error(`❌ Error en ${functionName}:`, error);
    throw error;
  }
};

/**
 * Verifica que el usuario esté autenticado
 * @returns {boolean} - true si está autenticado, false en caso contrario
 */
export const isUserAuthenticated = () => {
  return !!auth.currentUser;
};

/**
 * Obtiene el ID del usuario autenticado
 * @returns {string|null} - ID del usuario o null si no está autenticado
 */
export const getCurrentUserId = () => {
  return auth.currentUser?.uid || null;
}; 