import { StyleSheet, Dimensions } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, adaptiveFontSize, adaptiveSize } from '../utils/responsive';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.8,
    maxWidth: 350,
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: scaleSize(2),
    },
    shadowOpacity: 0.25,
    shadowRadius: scaleSize(4),
    elevation: 5,
  },
  title: {
    fontSize: adaptiveFontSize(18, 20, 22, 24),
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: scaleSpacing(12),
    textAlign: 'center',
  },
  message: {
    fontSize: adaptiveFontSize(15, 17, 18, 19),
    lineHeight: adaptiveFontSize(22, 24, 26, 28),
    color: '#333',
    marginBottom: scaleSpacing(20),
    textAlign: 'center',
  },
  okButton: {
    backgroundColor: '#ba5d17',
    paddingVertical: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(24),
    borderRadius: scaleSize(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  okButtonText: {
    color: '#fff',
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    fontWeight: 'bold',
  },
});

export default styles;

