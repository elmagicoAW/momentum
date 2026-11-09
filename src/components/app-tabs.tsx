import { useAppTheme } from '@/hooks/use-app-theme';
import { NativeTabs } from 'expo-router/native-tabs';

export default function AppTabs() {
  const { palette: Palette, scheme } = useAppTheme();
  return (
    <NativeTabs
      backgroundColor={Palette.surface}
      indicatorColor={Palette.accentSoft}
      rippleColor={scheme === 'dark' ? undefined : Palette.ripple}
      iconColor={{ default: Palette.textMuted, selected: Palette.accent }}
      labelStyle={{
        default: { color: Palette.textMuted },
        selected: { color: Palette.text },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max.fill" md="today" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="habits">
        <NativeTabs.Trigger.Label>Habits</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag.fill" md="flag" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="insights">
        <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="insights" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
