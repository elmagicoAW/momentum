import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Settings"
      description="Profile, reminders and app preferences will live here."
      icon={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
    />
  );
}
