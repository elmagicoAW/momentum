export type AchievementMetric = 'checkins' | 'activeDays' | 'streak' | 'types' | 'perfectDays' | 'perfectWeeks';
export type AchievementDefinition = {
  id: string;
  name: string;
  group: string;
  metric: AchievementMetric;
  target: number;
  criterion: string;
  detail: string;
  icon: 'sun' | 'strength' | 'music' | 'learn' | 'nature' | 'heart' | 'run' | 'walk' | 'mind' | 'art' | 'journal' | 'book';
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first-checkin', name: 'First Step', group: 'Check-ins', metric: 'checkins', target: 1, criterion: 'Complete your first check-in.', detail: 'One completed habit on one scheduled, finished local day.', icon: 'sun' },
  { id: 'checkins-10', name: 'Building Momentum', group: 'Check-ins', metric: 'checkins', target: 10, criterion: 'Complete 10 check-ins.', detail: 'Each habit counts once per scheduled day. Extra Count units and optional steps do not add check-ins.', icon: 'strength' },
  { id: 'checkins-50', name: 'Finding Your Rhythm', group: 'Check-ins', metric: 'checkins', target: 50, criterion: 'Complete 50 check-ins.', detail: 'Completed scheduled habit/date pairs across all readable finished history.', icon: 'music' },
  { id: 'checkins-100', name: 'Century', group: 'Check-ins', metric: 'checkins', target: 100, criterion: 'Complete 100 check-ins.', detail: 'Completed scheduled habit/date pairs across all readable finished history.', icon: 'learn' },
  { id: 'active-days-7', name: 'Show Up Seven', group: 'Showing up', metric: 'activeDays', target: 7, criterion: 'Check in on 7 different days.', detail: 'At least one completed scheduled habit on each of 7 finished days; days need not be consecutive.', icon: 'nature' },
  { id: 'active-days-30', name: 'Thirty Days of Effort', group: 'Showing up', metric: 'activeDays', target: 30, criterion: 'Check in on 30 different days.', detail: 'At least one completed scheduled habit on each of 30 finished days; days need not be consecutive.', icon: 'heart' },
  { id: 'streak-3', name: 'Three in a Row', group: 'Streaks', metric: 'streak', target: 3, criterion: '3 scheduled check-ins in a row.', detail: 'On one habit. Rest days are skipped; missed, partial and unreadable scheduled days break the known run.', icon: 'walk' },
  { id: 'streak-7', name: 'Steady Seven', group: 'Streaks', metric: 'streak', target: 7, criterion: '7 scheduled check-ins in a row.', detail: 'On one habit, across finished days. These are scheduled opportunities, not consecutive calendar days.', icon: 'run' },
  { id: 'streak-30', name: 'Staying Power', group: 'Streaks', metric: 'streak', target: 30, criterion: '30 scheduled check-ins in a row.', detail: 'On one habit. Unknown days never connect two known runs.', icon: 'mind' },
  { id: 'tracking-trio', name: 'All Three Ways', group: 'Tracking', metric: 'types', target: 3, criterion: 'Complete Tick, Count and Checklist.', detail: 'At least one finished scheduled completion of each saved tracking type, including historical types of an edited habit.', icon: 'art' },
  { id: 'perfect-day', name: 'A Day Well Spent', group: 'Perfect days', metric: 'perfectDays', target: 1, criterion: 'Complete every habit due on a day.', detail: 'A readable finished day with at least one habit due. Rest days alone never qualify.', icon: 'journal' },
  { id: 'perfect-week', name: 'A Week Well Spent', group: 'Perfect days', metric: 'perfectWeeks', target: 1, criterion: 'Complete every check-in in a finished week.', detail: 'Monday–Sunday, with at least one opportunity. All due habits must be complete; rest days are neutral. A first habit starting Friday can qualify after Sunday. Any unreadable day disqualifies the week.', icon: 'book' },
];

export const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((badge) => badge.id));
