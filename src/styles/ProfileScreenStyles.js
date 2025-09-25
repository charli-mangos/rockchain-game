import { StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingBottom: 25,  
    paddingTop: 30,
    width: '100%',
    backgroundColor: '#fff',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginVertical: 20,
    marginHorizontal: '30%',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatar: {
    width: 130,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inventoryInfo: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#87ceeb',
  },
  inventoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1d3d39',
  },
  inventoryStats: {
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  inventoryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  inventoryIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  inventoryStat: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4682b4',
  },
  productsTitle: {
    fontSize: 16,
    fontStyle: 'italic',  // Texto en itálica
    marginVertical: 10,
    textAlign: 'center',
  },
  flatList: {
    flex: 1,
    width: '100%',
  },
  flatListContainer: {
    justifyContent: 'center',  // Asegura que los elementos estén centrados
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',  // Fondo semitransparente
  },
  modalContent: {
    width: screenWidth * 0.8,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    position: 'relative',  // Necesario para posicionar el botón de cierre
    zIndex: 1000,
  },
  modalTitle: {
    width: '100%',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1d3d39',
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
  },
  icon: {
    flex: 1,
    alignItems: 'center',
  },
});

export default styles;
