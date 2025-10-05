import { StyleSheet } from 'react-native';

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
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1d3d39',
    backgroundColor: '#f8f8f8',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1d3d39',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 16,
    color: '#1d3d39',
    fontWeight: '600',
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  valueText: {
    fontSize: 16,
    color: '#1d3d39',
  },
  rockCoinIcon: {
    width: 20,
    height: 20,
    marginVertical: 2,
  },
  icon: {
    flex: 0.5,
    textAlign: 'center',
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
  marbleContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  chartContainer: {
    flex: 1,
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: '#ffffff',
    marginTop: 16,
  },
});

export default styles;
