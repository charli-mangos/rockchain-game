import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingBottom: 25,  
    paddingTop: 30,
    width: '100%',
    backgroundColor: '#fff',
  },
  // Selector de vista
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 21,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#1d3d39',
    borderColor: '#1d3d39',
  },
  viewModeText: {
    fontSize: 16,
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
    paddingHorizontal: 21,
    marginTop: 8,
    marginBottom: 12,
    gap: 12,
  },
  filterWrapper: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d3d39',
    marginBottom: 8,
    paddingLeft: 4,
  },
  dropdownStyle: {
    backgroundColor: '#fdf4e8',
    borderColor: '#1d3d39',
    borderWidth: 1.5,
    borderRadius: 8,
    minHeight: 50,
  },
  dropdownTextStyle: {
    color: '#1d3d39',
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownContainerStyle: {
    backgroundColor: '#fdf4e8',
    borderColor: '#1d3d39',
    borderWidth: 1.5,
    borderRadius: 8,
    marginTop: 4,
  },
  dropdownItemStyle: {
    color: '#1d3d39',
    fontSize: 16,
  },
  dropdownContainer: {
    width: '100%',
  },
  // Tabla mejorada
  tableContainer: {
    flex: 1,
    paddingHorizontal: 21,
    marginTop: 8,
    marginBottom: 16,
    minHeight: 200,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1d3d39',
    backgroundColor: '#f8f8f8',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
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
    fontWeight: '500',
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
  // Contenedor para el contenido del chart
  chartContentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  // Gráfica mejorada
  chartMetricContainer: {
    paddingHorizontal: 21,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  chartMetricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d3d39',
    marginBottom: 8,
  },
  chartDropdownContainer: {
    width: '100%',
    maxWidth: 200,
    height: 50,
  },
  chartWrapper: {
    flex: 1,
    paddingHorizontal: 21,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingTop: 24,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chartStyle: {
    marginTop: -10,
    marginBottom: -12,
    marginLeft: -12,
    marginRight: -15,
  },
});

export default styles;
