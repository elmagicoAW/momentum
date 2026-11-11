/** Only spacing is semantic here. Geometry, borders, text alignment and direction are owned by their components. */
const cache = new WeakMap<object, object>();
export function directionStyles<T extends object>(styles: T, rtl: boolean): T {
  if (!rtl) return styles;
  const saved = cache.get(styles); if (saved) return saved as T;
  const names: Record<string, string> = { marginLeft: 'marginStart', marginRight: 'marginEnd', paddingLeft: 'paddingStart', paddingRight: 'paddingEnd' };
  const result = Object.fromEntries(Object.entries(styles).map(([key, value]) => [key,
    typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value).map(([prop, entry]) => [names[prop] ?? prop, entry])) : value,
  ]));
  cache.set(styles, result); return result as T;
}
