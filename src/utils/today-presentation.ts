/** Card width is measured outside its padding/border; no window-width guess or text truncation. */
export function arabicTodayProgress(cardWidth: number | null, fontScale: number) {
  // Match English: 20dp padding + 1dp border, 148dp ring and 24dp gap.
  // Arabic prose may wrap naturally in the same flexible column as English.
  const innerWidth = cardWidth === null ? null : Math.max(0, cardWidth - 42);
  const minimumTextWidth = 104 * Math.max(1, fontScale);
  const stacked = fontScale > 1.5 || (innerWidth !== null && innerWidth < 148 + 24 + minimumTextWidth);
  return {
    stacked,
    ringSize: stacked ? 112 : 148,
    captionBelow: fontScale > 1.25,
    container: { direction: 'rtl' as const, flexDirection: stacked ? 'column' as const : 'row' as const,
      alignItems: stacked ? 'stretch' as const : 'center' as const, gap: 24, padding: 20 },
    text: { flexGrow: stacked ? 0 : 1, flexShrink: stacked ? 0 : 1,
      flexBasis: stacked ? 'auto' as const : 0, minWidth: 0, gap: 6, alignItems: 'stretch' as const },
  };
}
