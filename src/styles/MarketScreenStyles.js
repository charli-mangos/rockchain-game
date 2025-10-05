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
  timer: {
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  productContainer: {
    flex: 1,
    width: '40%',  // Cada producto ocupa el 40% del ancho
    padding: 10,
    marginVertical: 10,
    marginHorizontal: '5%',  // Márgenes laterales de 5% para centrar los productos
    borderWidth: 1,
    borderColor: '#1d3d39',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIcon: {
    width: 50,
    height: 50,
    marginBottom: 10,
  },
  productText: {
    fontSize: 16,
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
});

export default styles;
