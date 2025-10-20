import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const TutorialModal = ({ visible, onClose, tutorial, onNext, onPrevious, currentStep, totalSteps }) => {
  const { t } = useTranslation();
  const [showExample, setShowExample] = useState(false);

  if (!tutorial) return null;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      onNext();
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      onPrevious();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {currentStep + 1} / {totalSteps}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${((currentStep + 1) / totalSteps) * 100}%` }
                  ]} 
                />
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1d3d39" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={tutorial.icon || "school"} 
                size={60} 
                color="#1d3d39" 
              />
            </View>
            
            <Text style={styles.title}>{tutorial.title}</Text>
            
            <Text style={styles.description}>{tutorial.content}</Text>
            
            {tutorial.example && (
              <View style={styles.exampleContainer}>
                <TouchableOpacity 
                  style={styles.exampleButton}
                  onPress={() => setShowExample(!showExample)}
                >
                  <Text style={styles.exampleButtonText}>
                    {showExample ? 'Hide Example' : 'Show Example'}
                  </Text>
                  <Ionicons 
                    name={showExample ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#1d3d39" 
                  />
                </TouchableOpacity>
                
                {showExample && (
                  <View style={styles.exampleContent}>
                    <Text style={styles.exampleText}>{tutorial.example}</Text>
                  </View>
                )}
              </View>
            )}

            {tutorial.interactive && (
              <View style={styles.interactiveContainer}>
                <Ionicons name="hand-left" size={24} color="#FF9800" />
                <Text style={styles.interactiveText}>
                  This is an interactive tutorial - try it out in the game!
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.button, styles.previousButton, currentStep === 0 && styles.disabledButton]}
              onPress={handlePrevious}
              disabled={currentStep === 0}
            >
              <Ionicons name="chevron-back" size={20} color={currentStep === 0 ? "#ccc" : "#1d3d39"} />
              <Text style={[styles.buttonText, currentStep === 0 && styles.disabledButtonText]}>
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.nextButton]}
              onPress={handleNext}
            >
              <Text style={styles.buttonText}>
                {currentStep < totalSteps - 1 ? 'Next' : 'Got it!'}
              </Text>
              {currentStep < totalSteps - 1 && (
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressContainer: {
    flex: 1,
  },
  progressText: {
    fontSize: 14,
    color: '#1d3d39',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1d3d39',
    borderRadius: 2,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d3d39',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  exampleContainer: {
    marginBottom: 20,
  },
  exampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exampleButtonText: {
    fontSize: 14,
    color: '#1d3d39',
    marginRight: 8,
  },
  exampleContent: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1d3d39',
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1d3d39',
    fontStyle: 'italic',
  },
  interactiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  interactiveText: {
    fontSize: 14,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  previousButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nextButton: {
    backgroundColor: '#1d3d39',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d3d39',
  },
  disabledButtonText: {
    color: '#ccc',
  },
});

export default TutorialModal;
