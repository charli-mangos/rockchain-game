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
  // Selector de vista
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: scaleSpacing(21),
    marginTop: scaleSpacing(12),
    marginBottom: scaleSpacing(8),
    gap: scaleSpacing(8),
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(16),
    borderRadius: scaleSize(8),
    backgroundColor: '#f8f8f8',
    borderWidth: scaleSize(1.5),
    borderColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#1d3d39',
    borderColor: '#1d3d39',
  },
  viewModeText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: '600',
    color: '#1d3d39',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  // Filtros mejorados
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSpacing(21),
    marginTop: scaleSpacing(8),
    marginBottom: scaleSpacing(12),
    gap: scaleSpacing(12),
  },
  filterWrapper: {
    flex: 1,
  },
  filterLabel: {
    fontSize: adaptiveFontSize(12, 14, 15, 16),
    fontWeight: '600',
    color: '#1d3d39',
    marginBottom: scaleSpacing(8),
    paddingLeft: scaleSpacing(4),
  },
  dropdownStyle: {
    backgroundColor: '#fdf4e8',
    borderColor: '#1d3d39',
    borderWidth: scaleSize(1.5),
    borderRadius: scaleSize(8),
    minHeight: adaptiveSize(45, 50, 55, 60),
  },
  dropdownTextStyle: {
    color: '#1d3d39',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: '500',
  },
  dropdownContainerStyle: {
    backgroundColor: '#fdf4e8',
    borderColor: '#1d3d39',
    borderWidth: scaleSize(1.5),
    borderRadius: scaleSize(8),
    marginTop: scaleSpacing(4),
  },
  dropdownItemStyle: {
    color: '#1d3d39',
    fontSize: adaptiveFontSize(14, 16, 17, 18),
  },
  dropdownContainer: {
    width: '100%',
  },
  // Tabla mejorada
  tableContainer: {
    flex: 1,
    paddingHorizontal: scaleSpacing(21),
    marginTop: scaleSpacing(8),
    marginBottom: scaleSpacing(16),
    minHeight: adaptiveSize(180, 200, 220, 240),
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    borderWidth: scaleSize(1),
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: scaleSize(2),
    },
    shadowOpacity: 0.08,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: scaleSpacing(14),
    paddingHorizontal: scaleSpacing(12),
    borderBottomWidth: scaleSize(2),
    borderBottomColor: '#1d3d39',
    backgroundColor: '#f8f8f8',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: scaleSpacing(14),
    paddingHorizontal: scaleSpacing(12),
    borderBottomWidth: scaleSize(1),
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSpacing(4),
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSpacing(4),
  },
  headerText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
    fontWeight: '600',
  },
  nameText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    fontWeight: 'bold',
  },
  valueText: {
    fontSize: adaptiveFontSize(14, 16, 17, 18),
    color: '#1d3d39',
    fontWeight: '500',
  },
  rockCoinIcon: {
    width: adaptiveSize(18, 20, 22, 24),
    height: adaptiveSize(18, 20, 22, 24),
    marginVertical: scaleSpacing(2),
  },
  icon: {
    flex: 0.5,
    textAlign: 'center',
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
  // Contenedor para el contenido del chart
  chartContentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  // Gráfica mejorada
  chartMetricContainer: {
    paddingHorizontal: scaleSpacing(21),
    marginTop: scaleSpacing(8),
    marginBottom: scaleSpacing(12),
    alignItems: 'center',
  },
  chartMetricLabel: {
    fontSize: adaptiveFontSize(12, 14, 15, 16),
    fontWeight: '600',
    color: '#1d3d39',
    marginBottom: scaleSpacing(8),
  },
  chartDropdownContainer: {
    width: '100%',
    maxWidth: adaptiveSize(180, 200, 220, 240),
    height: adaptiveSize(45, 50, 55, 60),
  },
  chartWrapper: {
    flex: 1,
    paddingHorizontal: scaleSpacing(21),
    marginBottom: scaleSpacing(16),
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: scaleSpacing(12),
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    borderWidth: scaleSize(1),
    borderColor: '#e8e8e8',
    paddingTop: scaleSpacing(24),
    paddingRight: scaleSpacing(12),
    paddingBottom: scaleSpacing(12),
    paddingLeft: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: scaleSize(2),
    },
    shadowOpacity: 0.08,
    shadowRadius: scaleSize(4),
    elevation: 3,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chartStyle: {
    marginTop: -scaleSize(10),
    marginBottom: -scaleSize(12),
    marginLeft: -scaleSize(12),
    marginRight: -scaleSize(15),
  },
});

export default styles;
