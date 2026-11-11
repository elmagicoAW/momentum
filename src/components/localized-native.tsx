import { Text as NativeText, TextInput as NativeInput, StyleSheet } from 'react-native';
import { SymbolView as NativeSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { usePresentationLanguage } from '@/hooks/use-presentation-language';
import { isNumericDisplay, numericRun, textAlignment } from '@/utils/rtl-presentation';

export function Text(props: ComponentProps<typeof NativeText>) {
  const language = usePresentationLanguage();
  const flat = StyleSheet.flatten(props.style);
  return <NativeText {...props} numberOfLines={language === 'ar' ? undefined : props.numberOfLines} style={[props.style, { textAlign: textAlignment(language === 'ar', flat?.textAlign), writingDirection: 'auto', ...(language === 'ar' ? { letterSpacing: 0, flexShrink:1, minWidth:0, ...(flat?.lineHeight && flat.fontSize ? { lineHeight: Math.max(flat.lineHeight, Math.ceil(flat.fontSize * 1.65)) } : {}) } : {}) }]} />;
}
export function NumericText({ children, ...props }: Omit<ComponentProps<typeof NativeText>, 'children'> & {children: string}) {
  const language = usePresentationLanguage();
  if (!isNumericDisplay(children)) return <Text {...props}>{children}</Text>;
  return <NativeText {...props} style={[props.style, language === 'ar' && { writingDirection: 'ltr', textAlign: 'center',flexShrink:0 }]}>{numericRun(children, language === 'ar')}</NativeText>;
}
export function TextInput(props: ComponentProps<typeof NativeInput>) {
  const language = usePresentationLanguage();
  const flat = StyleSheet.flatten(props.style);
  return <NativeInput {...props} style={[props.style, { textAlign: textAlignment(language === 'ar', flat?.textAlign), writingDirection: 'auto' }]} />;
}
export function SymbolView(props: ComponentProps<typeof NativeSymbol>) {
  const language = usePresentationLanguage();
  const names = typeof props.name === 'string' ? [props.name] : Object.values(props.name ?? {});
  const directional = names.some(name => /chevron\.(left|right)|arrow_(back|forward)|chevron_(left|right)/.test(name));
  return <NativeSymbol {...props} style={[props.style, language === 'ar' && directional ? { transform: [{ scaleX: -1 }] } : undefined]} />;
}
