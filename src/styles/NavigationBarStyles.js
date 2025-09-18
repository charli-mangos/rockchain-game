import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    width: '100%',  // La barra de navegación ocupa todo el ancho
    justifyContent: 'center', // Centrar los botones en lugar de space-around
    alignItems: 'center', // Centrar verticalmente
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10, // Reducido de 15 a 10 para barra más compacta
    paddingBottom: 0, // Eliminar padding inferior para pegar al bottom
    backgroundColor: '#fff', // Asegurar fondo blanco
  },
  icon: {
    flex: 1, // Cada icono ocupa espacio igual
    alignItems: 'center', // Centramos el icono en su espacio
    justifyContent: 'center', // Centrar verticalmente
    paddingVertical: 5, // Reducido de 8 a 5 para barra más compacta
  },
});

export default styles;
