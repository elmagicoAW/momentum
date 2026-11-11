/** Resolve caller intent to a physical edge, then encode it for the actual text paragraph.
 * RN 0.88 Android treats left/start and right/end as paragraph-relative pairs.
 * Keep English's existing props; never mirror an explicit physical edge a second time.
 */
export function textAlignment(
  rtl: boolean,
  explicit?: 'auto' | 'left' | 'right' | 'center' | 'justify' | 'start' | 'end',
  platform = 'default',
  paragraphRTL = rtl,
) {
  const physical = explicit === 'start' ? (rtl ? 'right' : 'left')
    : explicit === 'end' ? (rtl ? 'left' : 'right')
    : explicit === undefined || (rtl && explicit === 'auto') ? (rtl ? 'right' : 'left') : explicit;
  if (rtl && platform === 'android' && (physical === 'left' || physical === 'right')) {
    return (physical === 'right') === paragraphRTL ? 'start' : 'end';
  }
  return physical;
}
/** Preserve the existing Input contract: AndroidTextInputShadowNode does not populate
 * paragraph direction from Yoga like ParagraphShadowNode. Do not reuse the Text adapter.
 */
export function inputTextAlignment(rtl: boolean, explicit?: 'auto' | 'left' | 'right' | 'center' | 'justify' | 'start' | 'end') {
  if (explicit === 'start') return rtl ? 'right' : 'left';
  if (explicit === 'end') return rtl ? 'left' : 'right';
  if (!rtl) return explicit ?? 'left';
  if (explicit === 'center' || explicit === 'justify') return explicit;
  if (explicit === 'right') return 'left';
  return 'right';
}
/** Display only: isolate an entire formatted number/ratio/percent, never stored text or input. */
export const numericRun = (text: string, rtl: boolean) => rtl ? `\u2066${text}\u2069` : text;
export const isNumericDisplay = (text: string) => /^[\d\u0660-\u0669\u06f0-\u06f9\s.,٬٫%٪/+−—–():\-\u061c\u200e\u200f]+$/.test(text);
/** Give Arabic prose its own full-width block beside fixed-size artwork on compact/large-type screens. */
export const stackProgress = (rtl: boolean, width: number, fontScale: number) => rtl && (width < 480 || fontScale > 1.2);
