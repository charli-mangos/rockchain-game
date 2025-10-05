import { StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingBottom: 25,  
    paddingTop: 30,
    width: '100%',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  headerText: {
    flex: 1,
    fontSize: 15,
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
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
    marginBottom: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d3d39',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  rockCoins: {
    flex: 0.5,
    fontSize: 16,
    textAlign: 'center',
  },
  waste: {
    flex: 0.5,
    fontSize: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
    color: '#1d3d39',
  },
  playersContainer: {
    flex: 1,
    paddingHorizontal: 21,
  },
  blocksContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderColor: '#1d3d39',
  },
  blockText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noBlocksText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#2d4a47',
  },
  rockTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 20,
    color: '#1d3d39',
  }
});

export default styles;