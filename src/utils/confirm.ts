import { appLabel } from '@/i18n/app-copy';
import { Alert, Platform } from 'react-native';

type Options = { title: string; message: string; confirmLabel: string };

/**
 * Asks the user to confirm a destructive action. Resolves true only when the
 * destructive button is pressed (Cancel, back button or tapping outside → false).
 */
export function confirmDestructive({ title, message, confirmLabel }: Options): Promise<boolean> {
  if (Platform.OS === 'web') {
    // react-native-web's Alert is a no-op.
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: appLabel("confirm.cancel"), style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
