import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AuthErrorPanelStyles';

const AuthErrorPanel = ({ error, errorCode, onDismiss, visible = false }) => {
  const { t } = useTranslation();

  // Mostrar el panel si hay error o errorCode, y está visible
  const shouldShow = (error || errorCode) && visible;
  if (!shouldShow) return null;

  const getErrorInfo = (code, message) => {
    // Priorizar el código de error si existe
    if (!code && message) {
      // Si no hay código pero hay mensaje, intentar detectar el tipo de error
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('username') || lowerMessage.includes('nombre de usuario') || message === 'username-required') {
        return {
          title: t('auth.errorPanel.usernameRequiredTitle'),
          message: t('auth.errorPanel.usernameRequiredMessage'),
        };
      }
      if (lowerMessage.includes('email') && (lowerMessage.includes('inválid') || lowerMessage.includes('invalid') || message === 'invalid-email')) {
        return {
          title: t('auth.errorPanel.invalidEmailTitle'),
          message: t('auth.errorPanel.invalidEmailMessage'),
        };
      }
      // Si no se puede detectar, mostrar genérico
      return {
        title: t('auth.errorPanel.genericErrorTitle'),
        message: t('auth.errorPanel.genericErrorMessage'),
      };
    }
    
    // Mapear códigos de error de Firebase Auth a información descriptiva
    switch (code) {
      case 'auth/wrong-password':
        return {
          title: t('auth.errorPanel.incorrectPasswordTitle'),
          message: t('auth.errorPanel.incorrectPasswordMessage'),
        };
      case 'auth/user-not-found':
        return {
          title: t('auth.errorPanel.userNotFoundTitle'),
          message: t('auth.errorPanel.userNotFoundMessage'),
        };
      case 'auth/invalid-email':
        return {
          title: t('auth.errorPanel.invalidEmailTitle'),
          message: t('auth.errorPanel.invalidEmailMessage'),
        };
      case 'auth/email-already-in-use':
        return {
          title: t('auth.errorPanel.emailInUseTitle'),
          message: t('auth.errorPanel.emailInUseMessage'),
        };
      case 'auth/weak-password':
        return {
          title: t('auth.errorPanel.weakPasswordTitle'),
          message: t('auth.errorPanel.weakPasswordMessage'),
        };
      case 'auth/network-request-failed':
        return {
          title: t('auth.errorPanel.networkErrorTitle'),
          message: t('auth.errorPanel.networkErrorMessage'),
        };
      case 'auth/too-many-requests':
        return {
          title: t('auth.errorPanel.tooManyRequestsTitle'),
          message: t('auth.errorPanel.tooManyRequestsMessage'),
        };
      case 'auth/operation-not-allowed':
        return {
          title: t('auth.errorPanel.operationNotAllowedTitle'),
          message: t('auth.errorPanel.operationNotAllowedMessage'),
        };
      default:
        // Si hay código pero no está en el switch, mostrar mensaje genérico
        return {
          title: t('auth.errorPanel.genericErrorTitle'),
          message: t('auth.errorPanel.genericErrorMessage'),
        };
    }
  };

  // Priorizar errorCode sobre error
  const errorInfo = getErrorInfo(errorCode, error || '');

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              <Text style={styles.title}>{errorInfo.title}</Text>
              <Text style={styles.message}>{errorInfo.message}</Text>
              <TouchableOpacity style={styles.okButton} onPress={handleDismiss}>
                <Text style={styles.okButtonText}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default AuthErrorPanel;

