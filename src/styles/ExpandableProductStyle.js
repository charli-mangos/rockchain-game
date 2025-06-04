import { StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
    productContainer: {
      flex: 1,
      width: '40%',
      aspectRatio: 1,
      padding: 10,
      marginVertical: 10,
      marginHorizontal: '5%',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productIcon: {
      width: '60%',
      height: '60%',
      marginBottom: 10,
    },
    productText: {
      fontSize: 16,
      textAlign: 'center',
      fontWeight: 'bold',
    },
    productPrice: {
      fontSize: 14,
      textAlign: 'center',
      color: '#888',
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    expandedContainer: {
      width: screenWidth * 0.9,
      padding: 20,
      backgroundColor: '#fff',
      borderRadius: 10,
      borderColor: '#ddd',
      borderWidth: 1,
      zIndex: 1000,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    closeButton: {
      position: 'absolute',
      right: 10,
    },
    expandedProductIcon: {
      width: 150,
      height: 150,
      marginTop: 10,
      marginBottom: 30,
      marginHorizontal: '30%',
    },
    detailText: {
      fontSize: 16,
      marginBottom: 5,
    },
    buttonsContainer: {
      marginTop: 20,
    },
    button: {
      backgroundColor: '#3366ff',
      padding: 10,
      borderRadius: 5,
      marginBottom: 10,
    },
    purchaseSummary: {
      padding: 10,
      backgroundColor: '#fff',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: '#ddd',
    },
    summaryText: {
      fontSize: 16,
      marginBottom: 10,
    },
    negativeText: {
      fontWeight: 'bold',
    },
    confirmationButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    confirmButton: {
      width: '50%',
      backgroundColor: '#28a745',
      padding: 10,
      borderRadius: 5,
      marginRight: 5,
    },
    cancelButton: {
      width: '50%',
      backgroundColor: '#dc3545',
      padding: 10,
      borderRadius: 5,
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    disabledButton: {
      backgroundColor: '#cccccc',
    },
    qualityBadge: {
      position: 'absolute',
      top: 5,
      left: 5,
      backgroundColor: '#FFD700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 5,
      zIndex: 10,
    },
    qualityText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff',
    },
  });
  
  export default styles;