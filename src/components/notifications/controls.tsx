"use no memo";
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/localized-native';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { normalizeNumericInput } from '@/i18n/format';
import { appLabel } from '@/i18n/app-copy';
import type { MessageKey } from '@/i18n/types';

export function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const { styles } = useAppStyles(createStyles);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }}
    disabled={disabled} onPress={() => onChange(!value)} style={[styles.button, value && styles.selected, disabled && styles.disabled]}>
    <Text style={styles.text}>{label}</Text><Text style={styles.mark}>{value ? '✓' : '○'}</Text>
  </Pressable>;
}
export function NotificationButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useAppStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.text}>{label}</Text></Pressable>;
}
export function NumericField({ label, value, onChange, disabled, time = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; time?: boolean }) {
  const { styles, scheme, language } = useAppStyles(createStyles);
  const display = language === 'ar' ? value.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : value;
  return <View style={styles.field}><Text style={styles.text}>{label}</Text>
    <TextInput accessibilityLabel={label} value={display} editable={!disabled} maxLength={time ? 5 : 2}
      keyboardType={time ? 'default' : 'number-pad'} keyboardAppearance={scheme}
      onChangeText={v => onChange(normalizeNumericInput(v))} style={styles.input} />
  </View>;
}
export function NotificationCopy({ id, error = false }: { id: MessageKey; error?: boolean }) {
  const { styles } = useAppStyles(createStyles);
  return <Text accessibilityLiveRegion={error ? 'polite' : 'none'} style={[styles.copy, error && styles.error]}>{appLabel(id)}</Text>;
}
function createStyles(p: AppPalette) { return StyleSheet.create({
  field: { gap: 8 }, text: { color: p.text, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  input: { color: p.text, backgroundColor: p.surfaceRaised, borderColor: p.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, minHeight: 48, textAlign: 'center', direction: 'ltr' },
  button: { minHeight: 48, padding: 12, borderRadius: 12, borderColor: p.controlBorder, borderWidth: 1, backgroundColor: p.surfaceRaised, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  selected: { borderColor: p.accent }, mark: { color: p.text, fontSize: 22 }, disabled: { opacity: 0.5 },
  copy: { color: p.textSecondary, fontSize: 14, lineHeight: 22 }, error: { color: p.danger },
}); }
