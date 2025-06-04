import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    width: '100%',  // La barra de navegación ocupa todo el ancho
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
  },
  icon: {
    flex: 1, // Cada icono ocupa 25% del ancho
    alignItems: 'center', // Centramos el icono en su espacio
  },
});

export default styles;
