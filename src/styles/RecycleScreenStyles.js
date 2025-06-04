import { StyleSheet, Dimensions } from 'react-native';

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        paddingBottom: 25,
        paddingTop: 30,
        width: '100%',
        backgroundColor: '#fff',
    },
    questContainer: {
        marginTop: '5%',
        paddingHorizontal: 21,
        flex:1,
    },
    questionText: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    text: {
        marginTop: 5,
        marginBottom: 10,
    },
    optionButton: {
      padding: 15,
      borderWidth: 1,
      borderRadius: 10,
      marginVertical: 5,
    },
    selectedOption: {
      backgroundColor: '#000',
      color: '#fff',
    },
    optionText: {
      fontSize: 16,
    },
    flatList: {
      flex: 1,
      width: '100%',
    },
    navBar: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderColor: '#ddd',
        paddingVertical: 10,
        paddingBottom: 20,  // Añadir padding inferior para evitar que la barra se superponga
    },
  });
  
  export default styles;