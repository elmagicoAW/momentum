import { Alert, Platform } from 'react-native';

/** One-button informational alert (works on web, where react-native-web's Alert is a no-op). */
export function showNotice(title: string, message: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message, [{ text: 'OK' }]);
}
