import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 25,
    paddingTop: 30,
    width: '100%',
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 21,
    paddingBottom: 100,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  industryContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  industryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  industryInfo: {
    gap: 12,
  },
  industryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  industryLabel: {
    fontSize: 16,
    color: '#666',
  },
  industryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  correctSelection: {
    color: '#2ecc71',
  },
  incorrectSelection: {
    color: '#e74c3c',
  },
  readyButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  waitingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  rewardContainer: {
    padding: 10,
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default styles; 