import { StyleSheet } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, widthPercentage, adaptiveFontSize } from '../utils/responsive';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: scaleSpacing(50),
  },
  input: {
    width: widthPercentage(80),
    height: scaleSize(45),
    borderColor: '#1d3d39',
    borderWidth: 1,
    marginBottom: scaleSpacing(20),
    paddingLeft: scaleSpacing(10),
    borderRadius: scaleSize(5),
  },
  button: {
    width: widthPercentage(80),
    backgroundColor: '#ba5d17',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(12),
    borderRadius: scaleSize(5),
    marginBottom: scaleSpacing(20),
  },
  buttonText: {
    color: '#fff',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
  },
  link: {
    color: '#ba5d17',
    marginTop: scaleSpacing(10),
    fontSize: adaptiveFontSize(13, 14, 15, 16),
  },
  linkRegister: {
    color: '#ba5d17',
    marginBottom: scaleSpacing(15),
    fontSize: adaptiveFontSize(13, 14, 15, 16),
  },
  errorText: {
    color: '#ba5d17',
    marginBottom: scaleSpacing(20),
    fontSize: adaptiveFontSize(13, 14, 15, 16),
  },
  languageSwitcherContainer: {
    marginBottom: scaleSpacing(20),
    marginTop: scaleSpacing(5),
    width: widthPercentage(80),
  },
});

export default styles;