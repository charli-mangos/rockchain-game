import { StyleSheet } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, widthPercentage, adaptiveFontSize, adaptiveSize } from '../utils/responsive';

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingBottom: scaleSpacing(25),  
    paddingTop: scaleSpacing(30),
    width: '100%',
    backgroundColor: '#fff',
  },
  horizontalContainer: {
    flexDirection: 'row',
    marginHorizontal: scaleSpacing(20),
    marginVertical: scaleSpacing(20),
    gap: scaleSpacing(10),
  },
  userInfoContainer: {
    flex: 1,
    alignItems: 'center',
    padding: scaleSpacing(10),
    backgroundColor: '#fdf4e8',
    borderRadius: scaleSize(10),
    borderWidth: scaleSize(1),
    borderColor: '#1d3d39',
  },
  avatar: {
    width: adaptiveSize(110, 130, 140, 150),
    height: adaptiveSize(85, 100, 110, 120),
    borderRadius: adaptiveSize(42.5, 50, 55, 60),
    marginBottom: scaleSpacing(20),
  },
  userName: {
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    fontWeight: 'bold',
  },
  inventoryInfo: {
    flex: 1,
    padding: scaleSpacing(15),
    backgroundColor: '#fdf4e8',
    borderRadius: scaleSize(10),
    borderWidth: scaleSize(1),
    borderColor: '#1d3d39',
  },
  inventoryTitle: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: scaleSpacing(10),
    color: '#1d3d39',
  },
  inventoryStats: {
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  inventoryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: scaleSpacing(4),
  },
  inventoryIcon: {
    width: adaptiveSize(18, 20, 22, 24),
    height: adaptiveSize(18, 20, 22, 24),
    marginRight: scaleSpacing(10),
    marginLeft: 0,
  },
  inventoryStat: {
    fontSize: adaptiveFontSize(12, 14, 15, 16),
    fontWeight: '600',
    color: '#1d3d39',
  },
  productsTitle: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontStyle: 'italic',  // Texto en itálica
    marginVertical: scaleSpacing(10),
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
    width: widthPercentage(80),
    alignItems: 'center',
    padding: scaleSpacing(20),
    backgroundColor: '#fff',
    borderRadius: scaleSize(10),
    position: 'relative',  // Necesario para posicionar el botón de cierre
    zIndex: 1000,
  },
  modalTitle: {
    width: '100%',
    fontSize: adaptiveFontSize(18, 20, 22, 24),
    fontWeight: 'bold',
    marginBottom: scaleSpacing(15),
    color: '#1d3d39',
  },
  input: {
    width: '100%',
    height: adaptiveSize(35, 40, 45, 50),
    borderColor: '#1d3d39',
    borderWidth: scaleSize(1),
    borderRadius: scaleSize(8),
    paddingHorizontal: scaleSpacing(10),
    marginBottom: scaleSpacing(10),
    fontSize: adaptiveFontSize(14, 16, 17, 18),
  },
  closeButton: {
    position: 'absolute',
    top: scaleSpacing(10),
    right: scaleSpacing(10),
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    borderTopWidth: scaleSize(1),
    borderColor: '#1d3d39',
    paddingVertical: scaleSpacing(10),
  },
  icon: {
    flex: 1,
    alignItems: 'center',
  },
  productContainer: {
    flex: 1,
    width: widthPercentage(40),  // Cada producto ocupa el 40% del ancho
    padding: scaleSpacing(10),
    marginVertical: scaleSpacing(10),
    marginHorizontal: widthPercentage(5),  // Márgenes laterales de 5% para centrar los productos
    borderWidth: scaleSize(1),
    borderColor: '#1d3d39',
    borderRadius: scaleSize(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIcon: {
    width: adaptiveSize(45, 50, 55, 60),
    height: adaptiveSize(45, 50, 55, 60),
    marginBottom: scaleSpacing(10),
  },
  productText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#1d3d39',
    paddingHorizontal: scaleSpacing(20),
    paddingVertical: scaleSpacing(12),
    borderRadius: scaleSize(8),
    marginTop: scaleSpacing(10),
    width: '100%',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
  },
});

export default styles;
