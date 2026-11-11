export function textAlignment(rtl: boolean, explicit?: 'auto' | 'left' | 'right' | 'center' | 'justify' | 'start' | 'end') {
  if (explicit === 'start') return rtl ? 'right' : 'left';
  if (explicit === 'end') return rtl ? 'left' : 'right';
  if (!rtl) return explicit ?? 'left';
  if (explicit === 'center' || explicit === 'justify') return explicit;
  if (explicit === 'right') return rtl ? 'left' : 'right';
  return rtl ? 'right' : 'left';
}
/** Display only: isolate an entire formatted number/ratio/percent, never stored text or input. */
export const numericRun = (text: string, rtl: boolean) => rtl ? `\u2066${text}\u2069` : text;
export const isNumericDisplay = (text: string) => /^[\d\u0660-\u0669\u06f0-\u06f9\s.,٬٫%٪/+−—–():\-\u061c\u200e\u200f]+$/.test(text);
/** Give Arabic prose its own full-width block beside fixed-size artwork on compact/large-type screens. */
export const stackProgress = (rtl: boolean, width: number, fontScale: number) => rtl && (width < 480 || fontScale > 1.2);
