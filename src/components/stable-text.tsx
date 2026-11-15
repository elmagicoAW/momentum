import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/localized-native';

type Props = {
  children: ReactNode;
  alternatives: readonly string[];
  textStyle: ComponentProps<typeof Text>['style'];
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  visible?: boolean;
  accessibilityLiveRegion?: ComponentProps<typeof Text>['accessibilityLiveRegion'];
};

/** Reserve the tallest copy at the available width before an interaction.
 * Equal-width, nonshrinking row cells measure alternatives at the SAME width;
 * the row height is their maximum, not their sum. No layout-effect/height loop,
 * fixed font-height guess, hidden accessibility copy or animation is needed. */
export function StableText({ children, alternatives, textStyle, style, numberOfLines, visible = true, accessibilityLiveRegion }: Props) {
  return <View style={[{ minWidth: 0 }, style]}>
    <View style={{ flexDirection: 'row', opacity: 0, overflow: 'hidden' }} pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {alternatives.map((text, index) => <View key={index} style={{ width: '100%', flexShrink: 0 }}>
        <Text style={textStyle} numberOfLines={numberOfLines}>{text}</Text>
      </View>)}
    </View>
    <Text style={[textStyle, StyleSheet.absoluteFill, !visible && { opacity: 0 }]}
      numberOfLines={numberOfLines} accessibilityLiveRegion={visible ? accessibilityLiveRegion : undefined}
      accessible={visible ? undefined : false} accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>{children}</Text>
  </View>;
}
