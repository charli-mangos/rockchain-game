import { StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        paddingBottom: 25,
        paddingTop: 30,
        width: '100%',
        backgroundColor: '#fff',
    },
    questContainer: {
        paddingHorizontal: 16,
        flex: 1,
        justifyContent: 'flex-start',
    },
    questionText: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 6,
      color: '#1d3d39',
    },
    text: {
        marginTop: 2,
        marginBottom: 6,
        fontSize: 14,
        lineHeight: 20,
        color: '#1d3d39',
    },
    subText: {
        marginTop: 2,
        marginBottom: 12,
        fontSize: 12,
        color: '#1d3d39',
        fontStyle: 'italic',
    },
    optionButton: {
      padding: 12,
      borderWidth: 2,
      borderRadius: 10,
      marginVertical: 4,
      borderColor: '#e0e0e0',
      backgroundColor: '#fff',
      shadowColor: '#1d3d39',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    selectedOption: {
      backgroundColor: '#fdf4e8',
      borderWidth: 2,
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    optionText: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    optionDescription: {
      fontSize: 12,
      lineHeight: 16,
    },
    checkIcon: {
      marginLeft: 6,
    },
    efficiencyContainer: {
      marginTop: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor: '#e8f5e8',
      borderRadius: 5,
      alignSelf: 'flex-start',
    },
    efficiencyText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#2e7d32',
    },
    educationalInfo: {
      marginTop: 8,
      padding: 8,
      backgroundColor: '#f8f9fa',
      borderRadius: 6,
      borderLeftWidth: 3,
      borderLeftColor: '#1d3d39',
    },
    educationalDescription: {
      fontSize: 12,
      lineHeight: 16,
      color: '#1d3d39',
    },
    flatList: {
      flex: 1,
      width: '100%',
    },
    flatListContent: {
      paddingBottom: 8,
    },
  });
  
  export default styles;