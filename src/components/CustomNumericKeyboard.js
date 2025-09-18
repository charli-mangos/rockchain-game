import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

const CustomNumericKeyboard = ({ value = '', onChange, style }) => {
  const handleKeyPress = (key) => {
    let newValue = value.toString();

    switch (key) {
      case 'backspace':
        newValue = newValue.slice(0, -1);
        break;
      case '-':
        // Solo permitir el signo menos al principio
        if (newValue.length === 0) {
          newValue = '-';
        }
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        // Permitir números después del signo menos
        if (newValue === '-') {
          newValue = '-' + key;
        } else {
          newValue += key;
        }
        break;
      default:
        return;
    }

    onChange(newValue);
  };

  const renderKey = (key, label, isSpecial = false) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.key,
        isSpecial && styles.specialKey,
        key === 'backspace' && styles.backspaceKey
      ]}
      onPress={() => handleKeyPress(key)}
      activeOpacity={0.6}
    >
      {key === 'backspace' ? (
        <Ionicons name="backspace-outline" size={28} color="#e74c3c" />
      ) : (
        <Text style={[styles.keyText, isSpecial && styles.specialKeyText]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.keyboard}>
        {/* Primera fila: 1, 2, 3 */}
        <View style={styles.row}>
          {renderKey('1', '1')}
          {renderKey('2', '2')}
          {renderKey('3', '3')}
        </View>

        {/* Segunda fila: 4, 5, 6 */}
        <View style={styles.row}>
          {renderKey('4', '4')}
          {renderKey('5', '5')}
          {renderKey('6', '6')}
        </View>

        {/* Tercera fila: 7, 8, 9 */}
        <View style={styles.row}>
          {renderKey('7', '7')}
          {renderKey('8', '8')}
          {renderKey('9', '9')}
        </View>

        {/* Cuarta fila: -, 0, ⌫ */}
        <View style={styles.row}>
          {renderKey('-', '-', true)}
          {renderKey('0', '0')}
          {renderKey('backspace', '⌫')}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 8, // Reducido de 12 a 8
    paddingBottom: 16, // Padding inferior mayor para separar del suelo
    marginHorizontal: 0, // Sin márgenes horizontales
    marginVertical: 4, // Reducido de 8 a 4
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    maxWidth: '100%', // Ocupar todo el ancho disponible
    alignSelf: 'center',
    width: '100%', // Asegurar que ocupe todo el ancho disponible
    // Mejorar adaptación a la pantalla
    minHeight: 240, // Reducido de 280 a 240 para teclado más compacto
  },
  keyboard: {
    gap: 8, // Reducido de 12 a 8
    width: '100%', // Asegurar que el teclado ocupe todo el ancho del contenedor
  },
  row: {
    flexDirection: 'row',
    gap: 8, // Reducido de 12 a 8
    justifyContent: 'space-between',
    width: '100%', // Asegurar que las filas ocupen todo el ancho
  },
  key: {
    flex: 1,
    height: 55, // Reducido de 65 a 55 para teclado más compacto
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 55, // Reducido de 65 a 55 para teclado más compacto
  },
  specialKey: {
    backgroundColor: '#f1f3f4',
    borderColor: '#dadce0',
    borderWidth: 2,
  },
  backspaceKey: {
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
    borderWidth: 2,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },
  specialKeyText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#34495e',
  },
});

export default CustomNumericKeyboard; 