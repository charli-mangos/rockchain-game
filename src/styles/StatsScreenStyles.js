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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(10),
    paddingHorizontal: scaleSpacing(15),
  },
  headerText: {
    flex: 1,
    fontSize: adaptiveFontSize(13, 15, 16, 17),
    color: '#2d4a47',
  },
  icon: {
    flex: 0.5,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(8),
    paddingHorizontal: scaleSpacing(15),
    backgroundColor: '#f9f9f9',
    marginBottom: scaleSpacing(5),
    borderRadius: scaleSize(8),
    borderWidth: scaleSize(1),
    borderColor: '#1d3d39',
  },
  name: {
    flex: 1,
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
  },
  rockCoins: {
    flex: 0.5,
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
  },
  waste: {
    flex: 0.5,
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
  },
  title: {
    fontSize: adaptiveFontSize(20, 24, 26, 28),
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: scaleSpacing(10),
    color: '#1d3d39',
  },
  playersContainer: {
    flex: 1,
    paddingHorizontal: scaleSpacing(21),
  },
  blocksContainer: {
    flex: 1,
    paddingHorizontal: scaleSpacing(16),
    paddingVertical: scaleSpacing(10),
    backgroundColor: '#f0f0f0',
    borderTopWidth: scaleSize(1),
    borderColor: '#1d3d39',
  },
  blockText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: '600',
  },
  noBlocksText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    textAlign: 'center',
    color: '#2d4a47',
  },
  rockTitle: {
    fontSize: adaptiveFontSize(18, 20, 22, 24),
    fontWeight: 'bold',
    padding: scaleSpacing(20),
    color: '#1d3d39',
  }
});

export default styles;