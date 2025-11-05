import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 25,
    paddingTop: 50,
    width: '100%',
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#1d3d39',
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
  yourSelectionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d3d39',
    textShadowColor: '#feda8c',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    textStrokeWidth: 3,
    textStrokeColor: '#feda8c',
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
  // Contenedor para el banner de éxito con cartelito de recompensa
  successBannerContainer: {
    position: 'relative',
    marginTop: 10,
  },
  // Banner de éxito para acertar industria
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d5a56',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#feda8c',
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  // Cartelito de recompensa de waste (similar al de minado)
  wasteRewardBadge: {
    position: 'absolute',
    top: -12,
    right: -25,
    backgroundColor: '#2d5a56',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#feda8c', // Borde amarillo
    opacity: 0.85, // Reducir opacidad para que no sean tan "pegostosos"
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  wasteRewardBadgeText: {
    color: '#feda8c',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successBannerIcon: {
    fontSize: 28,
    marginRight: 12,
    color: '#feda8c',
  },
  successBannerText: {
    flex: 1,
  },
  successBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#feda8c',
    marginBottom: 2,
  },
  successBannerSubtitle: {
    fontSize: 13,
    color: '#feda8c',
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
    borderWidth: 1,
    borderColor: '#1d3d39',
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
  // Estilos para el overlay de calculating
  calculatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  calculatingContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calculatingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1d3d39',
    marginTop: 16,
    textAlign: 'center',
  },
  calculatingSubtitle: {
    fontSize: 14,
    color: '#1d3d39',
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
  calculatingProgress: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2d5a56',
    borderRadius: 2,
    width: '0%', // Inicialmente vacío, se llena con animación
  },
});

export default styles; 