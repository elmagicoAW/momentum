import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function InsightsScreen() {
  return (
    <PlaceholderScreen
      title="Insights"
      description="See streaks, trends and how consistent you have been over time."
      icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'insights', web: 'insights' }}
    />
  );
}
