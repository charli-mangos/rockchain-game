import { StyleSheet } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, widthPercentage, adaptiveFontSize, adaptiveSize } from '../utils/responsive';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: scaleSpacing(50),
  },
  label: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    marginBottom: scaleSpacing(15),
  },
  bold: {
    fontWeight: 'bold',
  },
  inputContainer:{
    width: widthPercentage(80),
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    marginBottom: scaleSpacing(15),
  },
  input: {
    width: '100%',
    height: scaleSize(45),
    borderColor: '#1d3d39',
    borderWidth: 1,
    marginBottom: scaleSpacing(20),
    paddingLeft: scaleSpacing(10),
    borderRadius: scaleSize(5),
  },
  button: {
    width: '100%',
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
  title: {
    fontSize: adaptiveFontSize(20, 24, 26, 28),
    fontWeight: 'bold',
    marginBottom: scaleSpacing(10),
    textAlign: 'center',
    color: '#1d3d39',
  },
  subtitle: {
    fontSize: adaptiveFontSize(16, 18, 20, 22),
    marginBottom: scaleSpacing(20),
    textAlign: 'center',
    color: '#1d3d39',
  },
  divider: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
    marginVertical: scaleSpacing(20),
    color: '#1d3d39',
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
    color: '#1d3d39',
    fontStyle: 'italic',
  },
  roundButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(10),
    gap: scaleSpacing(15),
  },
  roundButton: {
    width: adaptiveSize(45, 50, 55, 60),
    height: adaptiveSize(45, 50, 55, 60),
    borderRadius: adaptiveSize(22.5, 25, 27.5, 30),
    backgroundColor: '#1d3d39',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default styles;