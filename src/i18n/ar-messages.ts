import type { TemplateDictionary } from '@/i18n/types';
import { todayArMessages } from './today-ar-messages';
import { remainingArMessages } from './remaining-ar-messages';

/** Draft Modern Standard Arabic; native copy review remains a release gate. */
export const arMessages = {
  ...remainingArMessages,
  ...todayArMessages,
  'today.progress': 'أُنجزت {completed} من أصل {total} من العادات',
  'today.greetingNamed': '{greeting}، {name}',
  'today.remaining': { zero: 'لا توجد عادات متبقية', one: 'تبقت عادة واحدة', two: 'تبقت عادتان', few: 'تبقت {count} عادات', many: 'تبقت {count} عادة', other: 'تبقى {count} من العادات' },
  'habits.count': { zero: 'لا توجد عادات', one: 'عادة واحدة', two: 'عادتان', few: '{count} عادات', many: '{count} عادة', other: '{count} من العادات' },
  'goals.count': { zero: 'لا توجد أهداف', one: 'هدف واحد', two: 'هدفان', few: '{count} أهداف', many: '{count} هدفًا', other: '{count} من الأهداف' },
  'routines.count': { zero: 'لا توجد روتينات', one: 'روتين واحد', two: 'روتينان', few: '{count} روتينات', many: '{count} روتينًا', other: '{count} من الروتينات' },
  'insights.days': { zero: 'لا توجد أيام', one: 'يوم واحد', two: 'يومان', few: '{count} أيام', many: '{count} يومًا', other: '{count} من الأيام' },
  'insights.checkins': { zero: 'لا توجد تسجيلات إتمام', one: 'تسجيل إتمام واحد', two: 'تسجيلا إتمام', few: '{count} تسجيلات إتمام', many: '{count} تسجيل إتمام', other: '{count} من تسجيلات الإتمام' },
  'habits.steps': { zero: 'لا توجد خطوات', one: 'خطوة واحدة', two: 'خطوتان', few: '{count} خطوات', many: '{count} خطوة', other: '{count} من الخطوات' },
  'achievements.count': { zero: 'لا توجد إنجازات', one: 'إنجاز واحد', two: 'إنجازان', few: '{count} إنجازات', many: '{count} إنجازًا', other: '{count} من الإنجازات' },
  'accessibility.profileNamed': 'الملف الشخصي: {name}. تعديل الملف الشخصي',
  'accessibility.habitProgress': '{name}: اكتمل {completed} من أصل {total}',
  'accessibility.moveHabit': 'نقل {name} إلى الموضع {position}',
  'settings.appearance.saved': 'الخيار المحفوظ: {appearance}',
  'validation.nameLimit': 'اجعل الاسم أقصر من {limit} حرفًا.',
  'validation.titleLimit': 'اجعل العنوان أقصر من {limit} حرفًا.',
  'validation.descriptionLimit': 'اجعل الوصف أقصر من {limit} حرفًا.',
  'validation.countRange': 'أدخل عددًا صحيحًا من {minimum} إلى {maximum}.',
  'validation.stepLimit': 'استخدم {limit} خطوة على الأكثر.',
  'validation.routineHabitLimit': 'يمكن أن يتضمن الروتين ما يصل إلى {limit} عادة.',
  'backup.created': 'تاريخ الإنشاء {date}. إصدار MOMENTUM {version}',
  'backup.records': { zero: 'لا توجد سجلات تخزين خام', one: 'سجل تخزين خام واحد', two: 'سجلا تخزين خام', few: '{count} سجلات تخزين خام', many: '{count} سجل تخزين خام', other: '{count} من سجلات التخزين الخام' },
  'backup.historyDates': { zero: 'لا توجد تواريخ في السجل', one: 'تاريخ واحد في السجل', two: 'تاريخان في السجل', few: '{count} تواريخ في السجل', many: '{count} تاريخًا في السجل', other: '{count} من التواريخ في السجل' },
  'backup.orphanReferences': { zero: 'لا توجد مراجع لعادات مفقودة أو محذوفة', one: 'حُفظ مرجع واحد لعادة مفقودة أو محذوفة.', two: 'حُفظ مرجعان لعادات مفقودة أو محذوفة.', few: 'حُفظت {count} مراجع لعادات مفقودة أو محذوفة.', many: 'حُفظ {count} مرجعًا لعادات مفقودة أو محذوفة.', other: 'حُفظ {count} من المراجع لعادات مفقودة أو محذوفة.' },
  'backup.unreadableFamily': 'محتويات {family} غير معروفة: تتضمن سجلات غير قابلة للقراءة أو غير مدعومة',
  'errors.recordUnreadable': 'تعذّرت قراءة السجل بتاريخ {date}. لم تُستبدَل بياناتك المحفوظة.',
} as const satisfies TemplateDictionary<'ar'>;
