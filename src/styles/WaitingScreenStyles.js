import { StyleSheet } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, widthPercentage, adaptiveFontSize, adaptiveSize } from '../utils/responsive';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: scaleSpacing(20),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: adaptiveFontSize(20, 24, 26, 28),
    fontWeight: 'bold',
    marginBottom: scaleSpacing(20),
    textAlign: 'center',
    color: '#1d3d39',
  },
  playerCountLabel: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
    marginBottom: scaleSpacing(20),
    textAlign: 'center',
  },
  subText: {
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    color: '#1d3d39',
    marginTop: scaleSpacing(10),
    textAlign: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleSpacing(20),
    backgroundColor: '#f0f0f0',
    borderRadius: scaleSize(10),
    marginVertical: scaleSpacing(20),
  },
  countdownText: {
    fontSize: adaptiveFontSize(28, 32, 34, 36),
    fontWeight: 'bold',
    color: '#1d3d39',
    textAlign: 'center',
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleSpacing(20),
  },
  startButton: {
    backgroundColor: '#ba5d17',
    paddingHorizontal: scaleSpacing(30),
    paddingVertical: scaleSpacing(15),
    borderRadius: scaleSize(25),
    marginTop: scaleSpacing(30),
    elevation: 3,
    shadowColor: '#1d3d39',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.25,
    shadowRadius: scaleSize(3.84),
  },
  startButtonText: {
    color: '#fff',
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    fontWeight: 'bold',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});