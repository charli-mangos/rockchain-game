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
        paddingHorizontal: 21,
        flex:1,
    },
    questionText: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#1d3d39',
    },
    text: {
        marginTop: 5,
        marginBottom: 10,
        fontSize: 16,
        lineHeight: 22,
        color: '#333',
    },
    subText: {
        marginTop: 5,
        marginBottom: 20,
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    optionButton: {
      padding: 16,
      borderWidth: 2,
      borderRadius: 12,
      marginVertical: 6,
      borderColor: '#e0e0e0',
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    selectedOption: {
      backgroundColor: '#424242',
      borderWidth: 2,
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    textContainer: {
      flex: 1,
    },
    optionText: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 14,
      lineHeight: 18,
    },
    checkIcon: {
      marginLeft: 8,
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