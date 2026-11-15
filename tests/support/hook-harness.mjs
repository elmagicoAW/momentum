import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Small effect/dependency runner for executable hooks with injected native
 * ports. It does not simulate Android rendering or navigation internals. */
export function hookHarness() {
  const slots = []; let cursor = 0; let effects = []; let dirty = false; let renderHook;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const effect = (fn, deps) => {
    const i = cursor++;
    if (!slots[i] || !equal(slots[i].deps, deps)) {
      const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup };
      effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
    }
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, next => {
        const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect: effect, useLayoutEffect: effect,
    useSyncExternalStore(subscribe, getSnapshot) {
      const [, update] = react.useState(0);
      effect(() => subscribe(() => update(n => n + 1)), [subscribe]);
      return getSnapshot();
    },
  };
  return {
    react,
    render(fn = renderHook) {
      renderHook = fn;
      let result; let count = 0;
      do {
        if (++count > 30) throw Error('Hook render loop');
        dirty = false; cursor = 0; effects = []; result = fn();
        effects.forEach(run => run());
      } while (dirty);
      return result;
    },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

export function loadSource(file, mocks) {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  new Function('require', 'exports', js)(name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name} in ${file}`);
    return mocks[name];
  }, exports);
  return exports;
}

export const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
