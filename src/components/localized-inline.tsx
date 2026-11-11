import {Text} from '@/components/localized-native';
import { Fragment } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';

/** No extra native wrapper: the parent Text and the named slot keep their existing styles. */
export function LocalizedInline({ message, slotStyle }: {
  message: { parts: string[]; slotValue: string }; slotStyle: StyleProp<TextStyle>;
}) {
  return <>{message.parts.map((part, index) => <Fragment key={index}>
    {index > 0 && <Text style={slotStyle}>{message.slotValue}</Text>}{part}
  </Fragment>)}</>;
}
