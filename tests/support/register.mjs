// Module-resolution hooks for the isolated tests (Node's built-in runner, no dependencies).
// - `@/…` → `src/…` (the tsconfig path alias), trying .ts / .tsx / index.ts
// - extensionless relative imports → .ts
// - `.ts` files are loaded as ES-module TypeScript (Node strips the types natively)
// - native-only packages → in-memory mocks (tests only import pure modules + storage)
import { statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const MOCKS = {
  '@react-native-async-storage/async-storage': 'tests/support/async-storage-mock.mjs',
};

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

function withExtension(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

const asResult = (file) => ({
  url: pathToFileURL(file).href,
  format: file.endsWith('.ts') ? 'module-typescript' : undefined,
  shortCircuit: true,
});

registerHooks({
  resolve(specifier, context, next) {
    if (MOCKS[specifier]) return asResult(path.join(root, MOCKS[specifier]));
    let base = null;
    if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
    else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      if (context.parentURL?.startsWith('file:')) {
        base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      }
    }
    if (base) {
      const file = withExtension(base);
      if (file) return asResult(file);
    }
    return next(specifier, context);
  },
});
