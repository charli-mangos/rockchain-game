import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

const ForgotPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState(auth.currentUser?.email ?? '');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert(t('app.error'), t('auth.emailRequired'));
      return;
    }
    if (!isValidEmail(trimmed)) {
      Alert.alert(t('app.error'), t('auth.invalidEmail'));
      return;
    }
    setResetLoading(true);
    setResetSuccess('');
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setResetSuccess(t('auth.resetEmailSent'));
    } catch (error) {
      console.error('ForgotPassword - send reset email error:', error);
      const code = error?.code;
      let message = t('auth.resetEmailError');
      if (code === 'auth/invalid-email') {
        message = t('auth.invalidEmail');
      } else if (code === 'auth/user-not-found') {
        message = t('auth.userNotFound');
      } else if (code === 'auth/too-many-requests') {
        message = t('auth.resetEmailTooManyRequests');
      } else if (code === 'auth/operation-not-allowed') {
        message = t('auth.resetEmailOperationNotAllowed');
      }
      Alert.alert(t('app.error'), message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
      <Text style={styles.subtitle}>{t('auth.forgotPasswordDescription')}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('auth.resetByEmailTitle')}</Text>
        <TextInput
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.button} onPress={handleSendReset} disabled={resetLoading}>
          {resetLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('auth.sendResetEmail')}</Text>
          )}
        </TouchableOpacity>
        {!!resetSuccess && <Text style={styles.successText}>{resetSuccess}</Text>}
      </View>

      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{t('app.back')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1d3d39',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#3c4d4a',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#f6f3ee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d3d39',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 44,
    borderColor: '#d0c6b8',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#ba5d17',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  successText: {
    marginTop: 10,
    color: '#1d3d39',
    textAlign: 'center',
  },
  backLink: {
    marginTop: 8,
  },
  backText: {
    color: '#1d3d39',
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
