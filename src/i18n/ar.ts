import type { Dictionary } from '@/i18n/types';

export const ar = {
  'preferences.invalid-record': 'تعذّرت قراءة تفضيلات المظهر واللغة المحفوظة. أعد محاولة تحميلها.',
  'preferences.unsupported-version': 'تم حفظ هذه التفضيلات بإصدار غير مدعوم من التطبيق.',
  'preferences.read-failed': 'تعذّر تحميل تفضيلات المظهر واللغة. يرجى إعادة المحاولة.',
  'preferences.write-failed': 'تعذّر حفظ تفضيلاتك. لم يتغيّر اختيارك السابق. يرجى إعادة المحاولة.',
  'preferences.not-loaded': 'يجب تحميل تفضيلاتك بنجاح قبل تغييرها.',
  'preferences.invalid-update': 'هذا الاختيار غير مدعوم.',
  'common.retry': 'إعادة المحاولة',
} as const satisfies Dictionary;
