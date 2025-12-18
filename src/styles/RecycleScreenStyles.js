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
    questContainer: {
        paddingHorizontal: scaleSpacing(16),
        flex: 1,
        justifyContent: 'flex-start',
    },
    questionText: {
      fontSize: adaptiveFontSize(14, 16, 17, 18),
      fontWeight: 'bold',
      marginBottom: scaleSpacing(6),
      color: '#1d3d39',
    },
    text: {
        marginTop: scaleSpacing(2),
        marginBottom: scaleSpacing(6),
        fontSize: adaptiveFontSize(12, 14, 15, 16),
        lineHeight: adaptiveFontSize(18, 20, 22, 24),
        color: '#1d3d39',
    },
    subText: {
        marginTop: scaleSpacing(2),
        marginBottom: scaleSpacing(12),
        fontSize: adaptiveFontSize(10, 12, 13, 14),
        color: '#1d3d39',
        fontStyle: 'italic',
    },
    optionButton: {
      padding: scaleSpacing(12),
      borderWidth: scaleSize(2),
      borderRadius: scaleSize(10),
      marginVertical: scaleSpacing(4),
      borderColor: '#e0e0e0',
      backgroundColor: '#fff',
      shadowColor: '#1d3d39',
      shadowOffset: {
        width: 0,
        height: scaleSize(2),
      },
      shadowOpacity: 0.1,
      shadowRadius: scaleSize(3),
      elevation: 3,
    },
    selectedOption: {
      backgroundColor: '#fdf4e8',
      borderWidth: scaleSize(2),
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: adaptiveSize(35, 40, 45, 50),
      height: adaptiveSize(35, 40, 45, 50),
      borderRadius: adaptiveSize(17.5, 20, 22.5, 25),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scaleSpacing(12),
    },
    textContainer: {
      flex: 1,
    },
    optionText: {
      fontSize: adaptiveFontSize(14, 16, 17, 18),
      fontWeight: '600',
      marginBottom: scaleSpacing(2),
    },
    optionDescription: {
      fontSize: adaptiveFontSize(10, 12, 13, 14),
      lineHeight: adaptiveFontSize(14, 16, 18, 20),
    },
    checkIcon: {
      marginLeft: scaleSpacing(6),
    },
    efficiencyContainer: {
      marginTop: scaleSpacing(6),
      paddingHorizontal: scaleSpacing(6),
      paddingVertical: scaleSpacing(3),
      backgroundColor: '#e8f5e8',
      borderRadius: scaleSize(5),
      alignSelf: 'flex-start',
    },
    efficiencyText: {
      fontSize: adaptiveFontSize(9, 11, 12, 13),
      fontWeight: '600',
      color: '#2e7d32',
    },
    educationalInfo: {
      marginTop: scaleSpacing(8),
      padding: scaleSpacing(8),
      backgroundColor: '#f8f9fa',
      borderRadius: scaleSize(6),
      borderLeftWidth: scaleSize(3),
      borderLeftColor: '#1d3d39',
    },
    educationalDescription: {
      fontSize: adaptiveFontSize(10, 12, 13, 14),
      lineHeight: adaptiveFontSize(14, 16, 18, 20),
      color: '#1d3d39',
    },
    flatList: {
      flex: 1,
      width: '100%',
    },
    flatListContent: {
      paddingBottom: scaleSpacing(8),
    },
  });
  
  export default styles;