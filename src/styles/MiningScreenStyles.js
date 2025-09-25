import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 25,
    paddingTop: 30,
    width: '100%',
    backgroundColor: '#fff',
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
  problemContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 20, // Reducido de 50 a 20
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  blockInfoContainer: {
    width: '100%',
    marginBottom: 10, // Reducido de 20 a 10
    alignItems: 'flex-start',
  },
  blockInfoText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6, // Reducido de 8 a 6
  },
  transactionInfoText: {
    fontSize: 16,
    color: '#666',
  },
  timerContainer: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace', // Fuente monoespaciada para mejor legibilidad del tiempo
  },
  mathContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10, // Reducido de 20 a 10
  },
  problemText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12, // Reducido de 16 a 12
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 18,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 16, // Aumentado de 8 a 16 para mejor espaciado
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 120,
  },
  waitingText: {
    fontSize: 20,
    marginTop: 20,
    color: '#34495e',
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50,
    width: '100%',
  },
  resultsHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#1d3d39',
  },
  messageContainer: {
    width: '100%',
    marginBottom: 50,
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  congratsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  resultText: {
    fontSize: 18,
    color: '#2c3e50',
  },
  wrongText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  blockContainer: {
    marginTop: 10,
    padding: 15,
    width: '90%',
    backgroundColor: '#ecf0f1',
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'center',
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 5,
  },
  blockText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  navButton: {
    padding: 10,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  miningButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miningButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: 120,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  miningButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navBar: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center', // Centrar los botones
    alignItems: 'center', // Centrar verticalmente
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10, // Reducido de 15 a 10 para barra más compacta
    paddingBottom: 0, // Eliminar padding inferior para pegar al bottom
    backgroundColor: '#fff', // Asegurar fondo blanco
  },
  icon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // Centrar verticalmente
    paddingVertical: 5, // Reducido de 8 a 5 para barra más compacta
  },
  nextBlockButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
    width: '80%',
    alignSelf: 'center',
    position: 'absolute',
    bottom: 100,
  },
  nextBlockButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Estilos para el campo de respuesta personalizado
  answerContainer: {
    width: '100%',
    marginBottom: 8, // Reducido de 16 a 8
    alignItems: 'center',
  },
  answerLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 4, // Reducido de 8 a 4
    textAlign: 'center',
  },
  answerDisplay: {
    width: '100%',
    height: 55, // Reducido de 70 a 55
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 8, // Mismo borderRadius que el botón Submit
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30, // Mismo padding que el botón Submit
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  answerDisplayActive: {
    borderColor: '#0056b3',
    backgroundColor: '#ffffff',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  answerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  // Estilos para el teclado personalizado
  customKeyboard: {
    marginBottom: 0,
    marginTop: 0,
    marginHorizontal: 16, // Márgenes laterales para mejor apariencia
    borderRadius: 0, // Sin bordes redondeados para que se adapte al modal
    shadowOpacity: 0, // Sin sombra para mejor integración
    elevation: 0,
  },
  // Estilos para el Modal del teclado
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent', // Sin fondo para ver el problema
    justifyContent: 'flex-end',
  },
  keyboardModal: {
    backgroundColor: 'rgba(248, 249, 250, 0.95)', // Fondo semi-transparente
    paddingBottom: 0, // Sin padding inferior para pegar al suelo
    paddingTop: 16, // Solo padding superior
    width: '100%', // Ocupar todo el ancho
    borderTopLeftRadius: 16, // Bordes redondeados solo arriba
    borderTopRightRadius: 16,
    // Asegurar que esté pegado al suelo
    position: 'absolute',
    bottom: 0,
    // Añadir sombra sutil para separación visual
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default styles;
