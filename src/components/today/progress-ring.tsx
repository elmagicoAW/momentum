"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text, NumericText} from '@/components/localized-native';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLanguage } from '@/hooks/use-language';
import { todayCopy, todayRich } from '@/i18n/today';
import { LocalizedInline } from '@/components/localized-inline';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  /** Keep scaled Arabic prose outside fixed artwork; the full summary remains font-scalable. */
  captionBelow?: boolean;
};

/**
 * Circular progress ring built from plain Views (no SVG dependency).
 * Two half-ring clips are rotated to reveal the arc clockwise from 12 o'clock.
 */
export function ProgressRing({ completed, total, size = 148, strokeWidth = 12, captionBelow = false }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { language } = useLanguage();
  const { m } = todayCopy(language);
  const ratio = total === 0 ? 0 : Math.min(completed / total, 1);
  const progress = useSharedValue(ratio);

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [ratio, progress]);

  const half = size / 2;
  const ringBase = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: strokeWidth,
  };

  // Angles are clockwise from 12 o'clock. A ring with two adjacent borders
  // coloured is a half-ring whose colour seams sit at the 45° diagonals.

  // Right clip shows 0–180°. Its arc uses left+bottom borders (135–315°);
  // +45° parks it at 180–360° (hidden), then it sweeps clockwise into view.
  const rightStyle = useAnimatedStyle(() => {
    const deg = Math.min(Math.max(progress.value, 0), 0.5) * 360;
    return {
      // Fully hide when empty so no anti-aliased hairline leaks at the clip edge.
      opacity: deg > 0 ? 1 : 0,
      transform: [{ rotate: `${45 + deg}deg` }],
    };
  });

  // Left clip shows 180–360°. Its arc uses top+right borders (315–135°);
  // +45° parks it at 0–180° (hidden in this clip), then it sweeps into view.
  const leftStyle = useAnimatedStyle(() => {
    const deg = Math.min(Math.max(progress.value - 0.5, 0), 0.5) * 360;
    return {
      opacity: deg > 0 ? 1 : 0,
      transform: [{ rotate: `${45 + deg}deg` }],
    };
  });

  const percent = Math.round(ratio * 100);

  const ring = (
    <View style={{ width: size, height: size, direction: 'ltr', flexShrink:0 }}>
      <View style={[ringBase, styles.track]} />

      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <Animated.View
          style={[
            ringBase,
            styles.arc,
            { left: -half, borderLeftColor: Palette.ring, borderBottomColor: Palette.ring },
            rightStyle,
          ]}
        />
      </View>

      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <Animated.View
          style={[
            ringBase,
            styles.arc,
            { left: 0, borderTopColor: Palette.accentBlue, borderRightColor: Palette.accentBlue },
            leftStyle,
          ]}
        />
      </View>

      <View style={styles.center}>
        {language === 'ar' ? <NumericText style={[styles.count,{maxWidth:size-strokeWidth*2-12, fontSize:28}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.2}>{m('today.ringCounter',{completed,denominator:m('today.ringDenominator',{total})})}</NumericText> : <Text style={styles.count}>
          <LocalizedInline message={todayRich(language, 'today.ringCounter', { completed, denominator: m('today.ringDenominator', { total }) }, 'denominator')} slotStyle={styles.total} />
        </Text>}
        {!captionBelow && <Text style={[styles.caption,{textAlign:'center',maxWidth:size-strokeWidth*2-12}]}>{m('today.percentDone', { percent })}</Text>}
      </View>
    </View>
  );
  return captionBelow ? <View style={{ alignItems: 'center', gap: 6, width: size }}>
    {ring}
    <Text style={[styles.caption, { textAlign: 'center', alignSelf: 'stretch' }]}>{m('today.percentDone', { percent })}</Text>
  </View> : ring;
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  track: {
    position: 'absolute',
    borderColor: Palette.ringTrack,
  },
  clip: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  arc: {
    position: 'absolute',
    top: 0,
    borderColor: 'transparent',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: Palette.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  total: {
    color: Palette.textMuted,
    fontSize: 22,
    fontWeight: '600',
  },
  caption: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
