import AppTabs from '@/components/app-tabs';
import { NotificationTapHandler } from '@/notifications/tap-handler';

/**
 * The five tabs (Today, Habits, Goals, Insights, Settings). Trigger names are unchanged.
 * The reminder tap handler lives here (renders nothing) so the navigator is
 * already mounted when a tapped notification navigates.
 */
export default function TabsLayout() {
  return (
    <>
      <AppTabs />
      <NotificationTapHandler />
    </>
  );
}
