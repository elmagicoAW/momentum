"use no memo";
import { View } from 'react-native';
import { appLabel } from '@/i18n/app-copy';
import { WeekdayPicker } from '@/components/habits/weekday-picker';
import { DEFAULT_REMINDER, setReminderEnabled, type HabitReminder } from '@/notifications/model';
import { Toggle, NumericField, NotificationCopy } from './controls';
import { PermissionNotice } from './permission-notice';
export function HabitReminderField({ value, onChange, color, disabled }: { value?: HabitReminder; onChange: (v: HabitReminder) => void; color: string; disabled: boolean }) {
  const r = value ?? DEFAULT_REMINDER;
  return <View style={{ gap: 12 }} pointerEvents={disabled ? 'none' : 'auto'}>
    <Toggle label={appLabel('notifications.reminder')} value={r.enabled} disabled={disabled} onChange={enabled => { if (!disabled) onChange(setReminderEnabled(r, enabled)); }} />
    {r.enabled && <>
      <NumericField label={appLabel('notifications.time')} value={r.time} onChange={time => onChange({ ...r, time })} time disabled={disabled} />
      <NotificationCopy id="notifications.days" />
      <WeekdayPicker kind={r.days.length === 7 ? 'daily' : 'weekdays'} days={r.days} color={color}
        onKindChange={kind => { if (!disabled) onChange({ ...r, days: kind === 'daily' ? [...DEFAULT_REMINDER.days] : [1, 2, 3, 4, 5] }); }}
        onDaysChange={days => { if (!disabled) onChange({ ...r, days }); }} />
      <NotificationCopy id="notifications.daysHint" />
      <PermissionNotice disabled={disabled} />
      <NotificationCopy id="notifications.limits" />
    </>}
  </View>;
}
