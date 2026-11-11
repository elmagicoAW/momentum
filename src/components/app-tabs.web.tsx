import {SymbolView} from '@/components/localized-native';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';

import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { GOALS_HREF, HABITS_HREF, HOME_HREF, INSIGHTS_HREF } from '@/utils/navigation';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  const { t } = useLanguage();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href={HOME_HREF} asChild>
            <TabButton>{t('navigation.today')}</TabButton>
          </TabTrigger>
          <TabTrigger name="habits" href={HABITS_HREF} asChild>
            <TabButton>{t('navigation.habits')}</TabButton>
          </TabTrigger>
          <TabTrigger name="goals" href={GOALS_HREF} asChild>
            <TabButton>{t('navigation.goals')}</TabButton>
          </TabTrigger>
          <TabTrigger name="insights" href={INSIGHTS_HREF} asChild>
            <TabButton>{t('navigation.insights')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>{t('navigation.settings')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// expo-router types the slot ref as `Ref<View>`, but with React Native 0.88 `View` is a
// component type, not an instance type. Type the ref as what Pressable actually receives.
type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & {
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>;
};

export function TabButton({ children, isFocused, ...props }: TabButtonProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const colors = useTheme();
  const { t } = useLanguage();

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          {t('navigation.brand')}
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">{t('navigation.docs')}</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
