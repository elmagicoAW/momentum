/** Card width is measured outside its padding/border; no window-width guess or text truncation. */
export function arabicTodayProgress(cardWidth: number | null, fontScale: number) {
  const innerWidth = cardWidth === null ? null : Math.max(0, cardWidth - 34);
  const minimumTextWidth = 176 * Math.max(1, fontScale);
  const stacked = innerWidth === null || innerWidth < 112 + 16 + minimumTextWidth;
  return {
    stacked,
    ringSize: stacked ? 96 : 112,
    captionBelow: fontScale > 1.25,
    container: { direction: 'rtl' as const, flexDirection: stacked ? 'column' as const : 'row' as const,
      alignItems: stacked ? 'stretch' as const : 'center' as const, gap: 16, padding: 16 },
    text: { flexGrow: stacked ? 0 : 1, flexShrink: stacked ? 0 : 1,
      flexBasis: stacked ? 'auto' as const : 0, minWidth: 0, gap: 4, alignItems: 'stretch' as const },
  };
}
