/** Explicit composition for Arabic surfaces; never applied to English or arbitrary style objects. */
export function arabicComposition(width: number, fontScale: number) {
  const narrow = width < 360 || fontScale > 1.25;
  return {
    surface: { direction: 'rtl' as const },
    heading: { direction: 'rtl' as const, flexDirection: narrow ? 'column' as const : 'row' as const, alignItems: narrow ? 'stretch' as const : 'center' as const, gap: 12 },
    textColumn: { flex: 0, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' as const, minWidth: 0, alignItems: 'stretch' as const, gap: 4 },
    row: { direction: 'rtl' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
    title: { textAlign: 'start' as const, alignSelf: 'stretch' as const },
    supporting: { textAlign: 'start' as const, alignSelf: 'stretch' as const, lineHeight: 22 },
    filters: { direction: 'rtl' as const, flexDirection: 'row' as const, gap: 8, paddingVertical: 4 },
    progress: { direction: 'rtl' as const, flexDirection: narrow ? 'column' as const : 'row' as const, alignItems: narrow ? 'stretch' as const : 'center' as const, gap: 16, padding: 16 },
    ringSize: narrow ? 96 : 112,
    gridTile: { flexBasis: narrow ? '100%' as const : '46%' as const, flexGrow: 1, minWidth: 0, minHeight: 0, gap: 6, padding: 14, direction: 'rtl' as const, alignItems: 'stretch' as const },
    metrics: { direction: 'rtl' as const, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
    metric: { flexBasis: narrow ? '100%' as const : 0, flexGrow: 1, minWidth: 0, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 8, gap: 4 },
    settingsRow: { direction: 'rtl' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 14 },
  };
}
