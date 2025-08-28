import React from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

const DismissKeyboardView = ({ children, style, ...props }) => (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={style} {...props}>
      {children}
    </View>
  </TouchableWithoutFeedback>
);

export default DismissKeyboardView; 