export const remainingEnMessages = {
  "goals.delete.title": "Delete “{name}”?",
  "habits.changeTracking.warning": "Changing “{name}” from {fromType} to {toType} resets today’s progress for this habit. ",
  "habits.delete.title": "Delete “{name}”?",
  "habits.delete.warning": "It will be removed from your habits and from Today.{goalNote}{routineNote} This can’t be undone.",
  "history.streak.ended": "Ended {date}",
  "history.month.finished": "{done} of {total} · finished days",
  "insights.overview.window": "Last {count} finished days",
  "insights.overview.missed": "{count} not checked in",
  "insights.streak.habit": "{name} · in a row",
  "backup.preview.currentRecordWarning": "Current device data: {error}. The original raw record will be preserved in the recovery copy.",
  "routines.rest.weekday": "Nothing in this routine is scheduled for {weekday}.",
  "routines.progress.remaining": "{count} to go — keep it rolling.",
  "routines.progress.habits": "{done} of {total} habits",
  "routines.habit.notScheduled": "{name}, not scheduled today, {schedule}",
  "routines.delete.title": "Delete “{name}”?",
  "achievements.recognized.date": "Recognized on {date}",
  "achievements.types.remaining": "Still to record: {types}.",
  "goals.consistency.accessibility": "Habit consistency {percent} percent",
  "goals.consistency.today": "{done} of {total} checked in so far",
  "goals.target.preset": "Target in {duration}",
  "goals.linked.count": "{count} habits linked",
  "goals.linked.selected": "{count} selected",
  "habits.step.placeholder": "Step {position}",
  "habits.step.nameAccessibility": "Step {position} name",
  "habits.step.requiredAccessibility": "Step {position} required",
  "habits.step.removeAccessibility": "Remove step {position}",
  "habits.steps.limit": "Up to {limit} steps",
  "insights.history.inferredStart": "History for {names} starts at the first saved check-in, which is earlier than the habit’s saved creation date. Days before that first check-in aren’t counted as scheduled or missed.",
  "history.day.notStartedAccessibility": "{title}. Not started.",
  "history.day.savedProgress": "Saved progress: {progress}",
  "history.streak.length": "{count}{uncertainty} in a row",
  "insights.period.previous": "Previous {unit}",
  "insights.period.earliest": "This is the earliest {unit} available",
  "insights.period.next": "Next {unit}",
  "insights.period.futureUnavailable": "Future {unit}s aren’t shown",
  "insights.period.jump": "Jump to {period}",
  "insights.trend.currentLabel": "{label}, so far",
  "insights.trend.accessibility": "{percent} percent, {done} of {total} check-ins",
  "insights.week.delta": "{arrow} {value} points vs the week before ({rate}).",
  "routines.move.up": "Move {name} up",
  "routines.move.down": "Move {name} down",
  "routines.habit.moveUp": "Move {name} up",
  "routines.habit.moveDown": "Move {name} down",
  "routines.habit.remove": "Remove {name} from this routine",
  "profile.summary.accessibility": "Profile: {name}. Edit name and avatar",
  "backup.summary.habits": "{total} habits ({done} Tick, {value} Count, {steps} Checklist)",
  "backup.summary.goals": "{total} goals ({done} active, {value} paused, {steps} completed)",
  "backup.summary.routines": "{count} routines; saved order preserved",
  "backup.summary.awards": "{total} awards, {done} acknowledged",
  "backup.record.unreadable": "{storageKey}: unreadable or unsupported record (raw data preserved)",
  "backup.references.missing": "{count} references to missing/deleted habits are preserved.",
  "backup.records.legacy": "{count} legacy shadow records retained; v2 keeps precedence.",
  "backup.family.unknown": "{label} contents unknown: unreadable/unsupported records included",
  "backup.family.missing": "No stored {family} record (unsaved defaults are not exported)",
  "backup.summary.history": "{count} history dates{dateRange}",
  "backup.summary.records": "{count} raw storage records",
  "backup.runtime.moduleUnavailable": "{moduleName} is unavailable in this native runtime. Update Expo Go to a compatible SDK 58 build, or use a newly compiled SDK 58 development build. Do not uninstall or clear app data.",
  "backup.runtime.moduleMissing": "{moduleName} is missing from this native app binary.",
  "backup.runtime.inspectionBlocked": "Recovery files cannot be inspected in this native runtime. Editing remains blocked to avoid exposing an interrupted replacement. {instructions}",
  "backup.runtime.cryptoUnavailable": "Data & Backup is unavailable: native ExpoCrypto SHA-256 could not be loaded or verified. No recovery journal exists, so the rest of MOMENTUM can continue. {instructions}",
  "backup.runtime.cryptoBlocked": "Recovery evidence exists, but native ExpoCrypto SHA-256 could not be loaded or verified. Editing remains blocked; no recovery verification has been skipped. {instructions}",
  "goals.timeline.completed": "Completed {date}",
  "goals.timeline.passed": "Target date passed · {date}",
  "goals.timeline.daysLeft": {
    "one": "{count} day left",
    "other": "{count} days left"
  },
  "goals.timeline.position": "Day {position} of {total} · {remaining}",
  "validation.goal.titleLength": "Keep the title under {limit} characters.",
  "validation.goal.descriptionLength": "Keep the description under {limit} characters.",
  "habits.tracking.target": "Target {target}",
  "habits.tracking.steps": {
    "one": "{count} step",
    "other": "{count} steps"
  },
  "validation.habit.nameLength": "Keep the name under {limit} characters.",
  "validation.habit.descriptionLength": "Keep the description under {limit} characters.",
  "validation.habit.countRange": "Enter a whole number from 1 to {maximum}.",
  "validation.habit.unitLength": "Keep the unit under {limit} characters.",
  "validation.habit.stepLimit": "Use at most {limit} steps.",
  "validation.habit.stepLength": "Keep each step under {limit} characters.",
  "insights.highlight.perfectHabit": "{name}: every scheduled check-in done{provisional}",
  "insights.highlight.streak": "{name}: {count} in a row{uncertainty}",
  "history.progress.count": "{value} of {target}{unit}",
  "history.progress.optional": " · {count} optional",
  "validation.profile.nameLength": "Keep your name under {limit} characters.",
  "validation.routine.habitLimit": "A routine can hold up to {limit} habits",
  "validation.routine.countLimit": "You can have up to {limit} routines",
  "routines.progress.allDone": "All {total} done",
  "routines.progress.done": "{done} of {total} done",
  "validation.routine.titleLength": "Keep the title to {limit} characters or fewer.",
  "validation.routine.descriptionLength": "Keep the description to {limit} characters or fewer.",
  "validation.routine.habitLimitSentence": "A routine can hold up to {limit} habits.",
  "habits.delete.goalNote": {
    "one": " It’s linked to {count} goal and will be unlinked; the goals themselves are kept.",
    "other": " It’s linked to {count} goals and will be unlinked; the goals themselves are kept."
  },
  "habits.delete.routineNote": {
    "one": " It’s in {count} routine and will be removed from it; the routines themselves are kept.",
    "other": " It’s in {count} routines and will be removed from them; the routines themselves are kept."
  },
  "history.allTime.finished": {
    "one": "{done} of {count} scheduled check-in · finished days",
    "other": "{done} of {count} scheduled check-ins · finished days"
  },
  "insights.overview.unreadable": {
    "one": " · {count} day couldn’t be read",
    "other": " · {count} days couldn’t be read"
  },
  "routines.deletedHabits.notice": {
    "one": "{count} habit in this routine was deleted. It’s ignored here and will be removed when you next save the routine. Past check-ins are kept.",
    "other": "{count} habits in this routine were deleted. They’re ignored here and will be removed when you next save the routine. Past check-ins are kept."
  },
  "routines.form.deletedHabits": {
    "one": "{count} habit was deleted and will be removed from this routine when you save.",
    "other": "{count} habits were deleted and will be removed from this routine when you save."
  },
  "insights.notes.unreadable": {
    "one": "{count} day of saved check-ins couldn’t be read. It is left out of every number, and streaks that touch it are marked “+” (may be longer). Statistics may be incomplete. Nothing was changed.",
    "other": "{count} days of saved check-ins couldn’t be read. They are left out of every number, and streaks that touch them are marked “+” (may be longer). Statistics may be incomplete. Nothing was changed."
  },
  "insights.notes.scheduleChange": {
    "one": "{names} has check-ins on days it isn’t scheduled now, so the schedule may have changed. Past numbers use the current schedule.",
    "other": "{names} have check-ins on days they aren’t scheduled now, so the schedule may have changed. Past numbers use the current schedule."
  },
  "insights.notes.ignored": {
    "one": "{count} saved day has a future or invalid date and is ignored.",
    "other": "{count} saved days have a future or invalid date and are ignored."
  },
  "insights.notes.deleted": {
    "one": "Check-ins of {count} deleted habit are kept in storage but not shown.",
    "other": "Check-ins of {count} deleted habits are kept in storage but not shown."
  },
  "routines.card.habits": {
    "one": "{count} habit",
    "other": "{count} habits"
  },
  "insights.highlight.perfectDays": {
    "one": "{count} perfect day — every scheduled habit done",
    "other": "{count} perfect days — every scheduled habit done"
  },
  "history.progress.required": {
    "one": "{done} of {count} required step{optional}",
    "other": "{done} of {count} required steps{optional}"
  },
  "display.timestamp": "{date}, {time}",
  "goals.list.activeCount": {
    "one": "{count} active goal",
    "other": "{count} active goals"
  },
  "goals.list.emptyFilter": "No {status} goals.",
  "habits.list.count": {
    "one": "{count} habit building momentum",
    "other": "{count} habits building momentum"
  },
  "routines.list.limit": "You’ve reached {limit} routines. Delete one to add another.",
  "goals.consistency.explanation": "Counted from {date}, using saved check-ins for this goal’s current linked habits. Past days use each habit’s current schedule — earlier schedules aren’t recorded, so if you changed a schedule, past counts may differ from what was actually planned. Today stays provisional until the day ends.",
  "history.habit.start": "History from {date}",
  "history.partial.days": {
    "one": "{count} missed day had some progress that didn’t meet the target.",
    "other": "{count} missed days had some progress that didn’t meet the target."
  },
  "insights.overview.perfect": {
    "one": "{count} perfect day in the last {total} days{unreadable}",
    "other": "{count} perfect days in the last {total} days{unreadable}"
  },
  "backup.preview.metadata": "Created {createdAt}\nMOMENTUM {version}",
  "routines.rest.notDue": "Not scheduled today ({total})",
  "routines.rest.explanation": "These habits aren’t due on {weekday}, so they can’t be checked off today — same as on Today.",
  "routines.remaining.short": {
    "one": "{count} left",
    "other": "{count} left"
  },
  "routines.remaining.withSave": "{remaining}{saving}",
  "goals.consistency.finished": {
    "one": "{done} of {count} scheduled check-in completed on past days",
    "other": "{done} of {count} scheduled check-ins completed on past days"
  },
  "goals.consistency.unreadable": {
    "one": "{count} day of saved check-ins couldn’t be read and is left out, so this may be incomplete. Nothing was changed.",
    "other": "{count} days of saved check-ins couldn’t be read and are left out, so this may be incomplete. Nothing was changed."
  },
  "history.notStarted.habits": {
    "one": "{count} habit hadn’t started yet — not counted.",
    "other": "{count} habits hadn’t started yet — not counted."
  },
  "insights.week.todayIncluded": {
    "one": "“Completed” includes {count} check-in from today (provisional).",
    "other": "“Completed” includes {count} check-ins from today (provisional)."
  },
  "insights.week.partial": {
    "one": "{count} missed check-in had some progress.",
    "other": "{count} missed check-ins had some progress."
  },
  "insights.week.unreadable": {
    "one": "{count} day this week couldn’t be read and is left out — this review may be incomplete.",
    "other": "{count} days this week couldn’t be read and are left out — this review may be incomplete."
  },
  "insights.week.best": "Strongest: {name} · {done} of {total}",
  "insights.week.attention": {
    "one": "Needs attention: {name} · {count} miss",
    "other": "Needs attention: {name} · {count} misses"
  },
  "insights.trend.footer": "Avg {average} · Best {best} · {note}",
  "settings.appearance.savedChoice": "Saved choice: {choice}",
  "settings.appearance.optionSaved": "{detail} Saved.",
  "achievements.card.accessibility": "{name}. {state}. {criterion} {progress}. {action} details.",
  "achievements.card.detail": "{detail} Only saved, finished local days count. Count targets and required Checklist steps use their saved snapshots.",
  "achievements.history.through": "Based on saved history through {date}.",
  "achievements.recognition.explanation": "Recognized on {timestamp}. This is the recognition time, not an original historical unlock time.",
  "achievements.evidence.withStart": "Saved evidence: {metric}, from {startDate} through {endDate}. This award stays earned after edits or deletions.",
  "achievements.evidence.noStart": "Saved evidence: {metric} through {endDate}. This award stays earned after edits or deletions.",
  "achievements.progress.checkins": "{value} / {target} check-ins",
  "achievements.progress.activeDays": "{value} / {target} different days",
  "achievements.progress.streak": "{value} / {target} scheduled check-ins on one habit",
  "achievements.progress.types": "{value} / {target} tracking types",
  "achievements.progress.perfectDays": "{value} / {target} perfect day",
  "achievements.progress.perfectWeeks": "{value} / {target} finished perfect week",
  "achievements.notes.unreadable": {
    "one": "At least {total} recorded check-ins; {count} saved day could not be read. Unknown days never connect a streak.",
    "other": "At least {total} recorded check-ins; {count} saved days could not be read. Unknown days never connect a streak."
  },
  "achievements.notes.ignored": "{count} invalid or future history records ignored.",
  "achievements.total": "{earned}{suffix}",
  "achievements.total.suffix": " / {total} earned",
  "display.ratio": "{value}/{maximum}",
  "display.percent": "{percent}%",
  "display.uncertainCount": "{count}{uncertainty}",
  "display.labelValue": "{label}, {textValue}",
  "display.labelText": "{label}. {text}",
  "display.labelColon": "{label}: {textValue}",
  "display.descriptionPair": "{first} · {second}",
  "display.headerDate": "{weekday}, {month} {day}",
  "display.profilePreview": "Preview: {greeting}",
  "display.greeting.named": "{greeting}, {name}",
  "display.greeting.unnamed": "{greeting}.",
  "history.calendar.accessibility": "{date}{today}. {summary}",
  "history.step.accessibility": "{name}{optional} {state}",
  "habits.tracking.unit": "{target} {unit}",
  "history.habit.progress": "{name}: {status}, {progress}",
  "history.habit.status": "{name}: {status}",
  "history.habit.statusProgress": "{status} · {progress}",
  "routines.entry.withCount": "Routines, {count}. {detail}",
  "routines.entry.noCount": "Routines. {detail}",
  "recovery.runtimeBlocked": "{reason}",
  "history.row.accessible": "{name}. {schedule}. Current streak {streak}. Best {best}. Consistency last 30 days {rate}.",
  "history.row.accessibleUncertain": "{name}. {schedule}. Current streak {streak}, may be longer. Best {best}. Consistency last 30 days {rate}.",
  "insights.week.complete.currentEmpty.plain": "No finished days yet this week",
  "insights.week.complete.currentEmpty.today": "No finished days yet this week · {completed} done today (provisional)",
  "insights.week.complete.currentEmpty.remaining": "No finished days yet this week · {steps} still to come",
  "insights.week.complete.currentEmpty.today-remaining": "No finished days yet this week · {completed} done today (provisional) · {steps} still to come",
  "insights.week.complete.currentEmpty.unreadable": "No finished days yet this week · {count} couldn’t be read",
  "insights.week.complete.currentEmpty.today-unreadable": "No finished days yet this week · {completed} done today (provisional) · {count} couldn’t be read",
  "insights.week.complete.currentEmpty.remaining-unreadable": "No finished days yet this week · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.currentEmpty.today-remaining-unreadable": "No finished days yet this week · {completed} done today (provisional) · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.current.plain": "So far: {done} of {total} finished check-ins completed",
  "insights.week.complete.current.percent": "So far: {done} of {total} finished check-ins completed ({percent}%)",
  "insights.week.complete.current.today": "So far: {done} of {total} finished check-ins completed · {completed} done today (provisional)",
  "insights.week.complete.current.percent-today": "So far: {done} of {total} finished check-ins completed ({percent}%) · {completed} done today (provisional)",
  "insights.week.complete.current.remaining": "So far: {done} of {total} finished check-ins completed · {steps} still to come",
  "insights.week.complete.current.percent-remaining": "So far: {done} of {total} finished check-ins completed ({percent}%) · {steps} still to come",
  "insights.week.complete.current.today-remaining": "So far: {done} of {total} finished check-ins completed · {completed} done today (provisional) · {steps} still to come",
  "insights.week.complete.current.percent-today-remaining": "So far: {done} of {total} finished check-ins completed ({percent}%) · {completed} done today (provisional) · {steps} still to come",
  "insights.week.complete.current.unreadable": "So far: {done} of {total} finished check-ins completed · {count} couldn’t be read",
  "insights.week.complete.current.percent-unreadable": "So far: {done} of {total} finished check-ins completed ({percent}%) · {count} couldn’t be read",
  "insights.week.complete.current.today-unreadable": "So far: {done} of {total} finished check-ins completed · {completed} done today (provisional) · {count} couldn’t be read",
  "insights.week.complete.current.percent-today-unreadable": "So far: {done} of {total} finished check-ins completed ({percent}%) · {completed} done today (provisional) · {count} couldn’t be read",
  "insights.week.complete.current.remaining-unreadable": "So far: {done} of {total} finished check-ins completed · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.current.percent-remaining-unreadable": "So far: {done} of {total} finished check-ins completed ({percent}%) · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.current.today-remaining-unreadable": "So far: {done} of {total} finished check-ins completed · {completed} done today (provisional) · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.current.percent-today-remaining-unreadable": "So far: {done} of {total} finished check-ins completed ({percent}%) · {completed} done today (provisional) · {steps} still to come · {count} couldn’t be read",
  "insights.week.complete.finished.plain": "{done} of {total} scheduled check-ins completed",
  "insights.week.complete.finished.percent": "{done} of {total} scheduled check-ins completed ({percent}%)",
  "insights.week.complete.finished.unreadable": "{done} of {total} scheduled check-ins completed · {count} couldn’t be read",
  "insights.week.complete.finished.percent-unreadable": "{done} of {total} scheduled check-ins completed ({percent}%) · {count} couldn’t be read",
  "insights.complete.day.finished.readable": {
    "one": "{done} of {count} scheduled check-in completed",
    "other": "{done} of {count} scheduled check-ins completed"
  },
  "insights.complete.day.finished.unreadable": {
    "one": "{done} of {count} scheduled check-in completed · {total} couldn’t be read",
    "other": "{done} of {count} scheduled check-ins completed · {total} couldn’t be read"
  },
  "insights.complete.day.today.readable": {
    "one": "{done} of {count} scheduled check-in completed so far (provisional)",
    "other": "{done} of {count} scheduled check-ins completed so far (provisional)"
  },
  "insights.complete.day.today.unreadable": {
    "one": "{done} of {count} scheduled check-in completed so far (provisional) · {total} couldn’t be read",
    "other": "{done} of {count} scheduled check-ins completed so far (provisional) · {total} couldn’t be read"
  },
  "insights.complete.calendar.finished.readable": {
    "one": "{done} of {count} check-in",
    "other": "{done} of {count} check-ins"
  },
  "insights.complete.calendar.finished.unreadable": {
    "one": "{done} of {count} check-in, {total} couldn’t be read",
    "other": "{done} of {count} check-ins, {total} couldn’t be read"
  },
  "insights.complete.calendar.today.readable": {
    "one": "{done} of {count} check-in so far, provisional",
    "other": "{done} of {count} check-ins so far, provisional"
  },
  "insights.complete.calendar.today.unreadable": {
    "one": "{done} of {count} check-in so far, provisional, {total} couldn’t be read",
    "other": "{done} of {count} check-ins so far, provisional, {total} couldn’t be read"
  },
  "history.calendar.unreadableRecord": "{summary}, saved record couldn’t be read"
} as const;
