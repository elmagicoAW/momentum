import { useAppTheme } from '@/hooks/use-app-theme';
import { useLanguage } from '@/hooks/use-language';
import { NativeTabs } from 'expo-router/native-tabs';
import { router, type Href } from 'expo-router';
import { useFormTabProtection } from '@/hooks/use-form-navigation';
import { formNavigation } from '@/utils/form-navigation';

export default function AppTabs() {
  const { palette: Palette, scheme } = useAppTheme();
  const { t, direction } = useLanguage();
  const protectedForm = useFormTabProtection();
  // SDK 58 native tabPress is not preventable. Disabled triggers emit a
  // prevented event; replay programmatic navigation only after safe discard.
  const guardedTab = (href: Href) => ({
    disabled: protectedForm,
    listeners: { tabPress: (event: { data: { isPrevented: boolean } }) => {
      if (event.data.isPrevented) formNavigation.requestTab(() => router.navigate(href));
    } },
  });
  return (
    <NativeTabs
      unstable_nativeProps={{ direction }}
      backgroundColor={Palette.surface}
      indicatorColor={Palette.accentSoft}
      rippleColor={scheme === 'dark' ? undefined : Palette.ripple}
      iconColor={{ default: Palette.textMuted, selected: Palette.accent }}
      labelStyle={{
        default: { color: Palette.textMuted },
        selected: { color: Palette.text },
      }}>
      <NativeTabs.Trigger name="index" {...guardedTab('/' as Href)}>
        <NativeTabs.Trigger.Label>{t('navigation.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max.fill" md="today" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="habits" {...guardedTab('/habits' as Href)}>
        <NativeTabs.Trigger.Label>{t('navigation.habits')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="goals" {...guardedTab('/goals' as Href)}>
        <NativeTabs.Trigger.Label>{t('navigation.goals')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag.fill" md="flag" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="insights" {...guardedTab('/insights' as Href)}>
        <NativeTabs.Trigger.Label>{t('navigation.insights')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="insights" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" {...guardedTab('/settings')}>
        <NativeTabs.Trigger.Label>{t('navigation.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
