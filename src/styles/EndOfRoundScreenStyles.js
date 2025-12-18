import { StyleSheet } from 'react-native';
import { scaleSize, scaleFont, scaleSpacing, widthPercentage, adaptiveFontSize, adaptiveSize } from '../utils/responsive';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: scaleSpacing(25),
    paddingTop: scaleSpacing(50),
    width: '100%',
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: scaleSpacing(20),
    paddingHorizontal: scaleSpacing(20),
  },
  title: {
    fontSize: adaptiveFontSize(24, 28, 30, 32),
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: scaleSpacing(8),
  },
  subtitle: {
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    color: '#1d3d39',
  },
  content: {
    flex: 1,
    paddingHorizontal: scaleSpacing(21),
    paddingBottom: scaleSpacing(120),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scaleSpacing(20),
  },
  industryContainer: {
    marginTop: scaleSpacing(16),
    marginBottom: scaleSpacing(16),
  },
  industryTitle: {
    fontSize: adaptiveFontSize(18, 20, 22, 24),
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: scaleSpacing(10),
  },
  industryInfo: {
    gap: scaleSpacing(8),
  },
  industryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(6),
    paddingHorizontal: scaleSpacing(12),
    backgroundColor: '#fff',
    borderRadius: scaleSize(6),
    borderWidth: scaleSize(1),
    borderColor: '#eee',
  },
  industryLabel: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
  },
  industryValue: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    color: '#1d3d39',
  },
  yourSelectionValue: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    color: '#1d3d39',
    textShadowColor: '#feda8c',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    textStrokeWidth: scaleSize(3),
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
    paddingVertical: scaleSpacing(16),
    paddingHorizontal: scaleSpacing(32),
    borderRadius: scaleSize(8),
    alignItems: 'center',
    position: 'absolute',
    bottom: scaleSpacing(30),
    left: scaleSpacing(20),
    right: scaleSpacing(20),
  },
  readyButtonText: {
    color: '#fff',
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    fontWeight: 'bold',
  },
  waitingContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: scaleSpacing(20),
    left: scaleSpacing(16),
    right: scaleSpacing(16),
  },
  waitingText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
    marginTop: scaleSpacing(16),
  },
  rewardContainer: {
    padding: scaleSpacing(12),
    backgroundColor: '#2d5a56',
    borderRadius: scaleSize(8),
    alignItems: 'center',
    marginTop: scaleSpacing(6),
  },
  rewardText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: adaptiveFontSize(20, 22, 24, 26),
  },
  // Contenedor para el banner de éxito con cartelito de recompensa
  successBannerContainer: {
    position: 'relative',
    marginTop: scaleSpacing(6),
  },
  // Banner de éxito para acertar industria
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d5a56',
    padding: scaleSpacing(12),
    borderRadius: scaleSize(10),
    borderWidth: scaleSize(2),
    borderColor: '#feda8c',
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: scaleSize(3),
    },
    shadowOpacity: 0.25,
    shadowRadius: scaleSize(6),
    elevation: 6,
  },
  // Cartelito de recompensa de waste (similar al de minado)
  wasteRewardBadge: {
    position: 'absolute',
    top: -scaleSize(12),
    right: -scaleSize(25),
    backgroundColor: '#2d5a56',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleSpacing(8),
    paddingVertical: scaleSpacing(4),
    borderWidth: scaleSize(1),
    borderColor: '#feda8c', // Borde amarillo
    opacity: 0.85, // Reducir opacidad para que no sean tan "pegostosos"
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: scaleSize(2),
    },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(3),
    elevation: 5,
    zIndex: 10,
  },
  wasteRewardBadgeText: {
    color: '#feda8c',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successBannerIcon: {
    fontSize: adaptiveSize(24, 28, 30, 32),
    marginRight: scaleSpacing(12),
    color: '#feda8c',
  },
  successBannerText: {
    flex: 1,
  },
  successBannerTitle: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    color: '#feda8c',
    marginBottom: scaleSpacing(2),
  },
  successBannerSubtitle: {
    fontSize: adaptiveFontSize(11, 13, 14, 15),
    color: '#feda8c',
    opacity: 0.9,
    lineHeight: adaptiveFontSize(16, 18, 20, 22),
  },
  // Banner de fallo para no acertar industria
  failBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf4e8',
    padding: scaleSpacing(12),
    borderRadius: scaleSize(10),
    marginTop: scaleSpacing(6),
    borderWidth: scaleSize(1),
    borderColor: '#1d3d39',
    shadowColor: '#fdf4e8',
    shadowOffset: {
      width: 0,
      height: scaleSize(3),
    },
    shadowOpacity: 0.25,
    shadowRadius: scaleSize(6),
    elevation: 6,
  },
  failBannerIcon: {
    fontSize: adaptiveSize(24, 28, 30, 32),
    marginRight: scaleSpacing(12),
    color: '#1d3d39',
  },
  failBannerText: {
    flex: 1,
  },
  failBannerTitle: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: scaleSpacing(2),
  },
  failBannerSubtitle: {
    fontSize: adaptiveFontSize(11, 13, 14, 15),
    color: '#1d3d39',
    opacity: 0.9,
    lineHeight: adaptiveFontSize(16, 18, 20, 22),
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
    borderRadius: scaleSize(16),
    padding: scaleSpacing(32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: scaleSize(4),
    },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(8),
    elevation: 8,
  },
  calculatingTitle: {
    fontSize: adaptiveFontSize(16, 18, 19, 20),
    fontWeight: '600',
    color: '#1d3d39',
    marginTop: scaleSpacing(16),
    textAlign: 'center',
  },
  calculatingSubtitle: {
    fontSize: adaptiveFontSize(12, 14, 15, 16),
    color: '#1d3d39',
    opacity: 0.7,
    marginTop: scaleSpacing(8),
    textAlign: 'center',
  },
  calculatingProgress: {
    marginTop: scaleSpacing(20),
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: widthPercentage(80),
    height: scaleSize(4),
    backgroundColor: '#e0e0e0',
    borderRadius: scaleSize(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2d5a56',
    borderRadius: scaleSize(2),
    width: '0%', // Inicialmente vacío, se llena con animación
  },
});

export default styles; 