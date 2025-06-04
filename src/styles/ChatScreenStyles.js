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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 21,
  },
  headerText: {
    flex: 1,
    fontSize: 15,
    color: '#888',
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
    marginBottom: 1,
    marginHorizontal: 21,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
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
  },
  chartContainer: {
    flex: 1,
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: '#ffffff',
  },
});

export default styles;
