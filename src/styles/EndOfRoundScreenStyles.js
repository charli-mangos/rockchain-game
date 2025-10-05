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
    paddingBottom: 120,
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
    color: '#1d3d39',
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
    color: '#1d3d39',
  },
  industryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d3d39',
  },
  correctSelection: {
    color: '#2d5a56',
  },
  incorrectSelection: {
    color: '#ba5d17',
  },
  readyButton: {
    backgroundColor: '#ba5d17',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
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
    color: '#1d3d39',
    marginTop: 16,
  },
  rewardContainer: {
    padding: 15,
    backgroundColor: '#2d5a56',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  rewardText: {
    fontSize: 16,
    color: '#1d3d39',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Banner de éxito para acertar industria
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d5a56',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  successBannerIcon: {
    fontSize: 28,
    marginRight: 12,
    color: '#1d3d39',
  },
  successBannerText: {
    flex: 1,
  },
  successBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 2,
  },
  successBannerSubtitle: {
    fontSize: 13,
    color: '#1d3d39',
    opacity: 0.9,
    lineHeight: 18,
  },
  // Banner de fallo para no acertar industria
  failBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf4e8',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#fdf4e8',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  failBannerIcon: {
    fontSize: 28,
    marginRight: 12,
    color: '#1d3d39',
  },
  failBannerText: {
    flex: 1,
  },
  failBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 2,
  },
  failBannerSubtitle: {
    fontSize: 13,
    color: '#1d3d39',
    opacity: 0.9,
    lineHeight: 18,
  },
});

export default styles; 