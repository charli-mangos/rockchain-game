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
  timer: {
    fontSize: adaptiveFontSize(18, 20, 22, 24),
    marginBottom: scaleSpacing(10),
    textAlign: 'center',
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
  flatList: {
    flex: 1,
    width: '100%',
  },
  flatListContainer: {
    justifyContent: 'center',  // Asegura que los elementos estén centrados
  },
  icon: {
    flex: 1,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleSpacing(20),
  },
  loadingText: {
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    color: '#666',
    textAlign: 'center',
  },
});

export default styles;
