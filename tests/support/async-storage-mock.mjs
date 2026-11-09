// In-memory AsyncStorage with failure injection, for deterministic storage tests.
const data = new Map();
const failures = { getItem: false, setItem: false };
const writes = [];

const maybeFail = (op) => {
  if (failures[op]) throw new Error(`Simulated ${op} failure`);
};

const AsyncStorage = {
  async getItem(key) {
    maybeFail('getItem');
    return data.has(key) ? data.get(key) : null;
  },
  async setItem(key, value) {
    maybeFail('setItem');
    writes.push(key);
    data.set(key, value);
  },
  async getAllKeys() {
    return [...data.keys()];
  },
  async multiGet(keys) {
    return keys.map((k) => [k, data.has(k) ? data.get(k) : null]);
  },
};

export default AsyncStorage;

/** Test helpers. */
export const mock = {
  reset() {
    data.clear();
    writes.length = 0;
    failures.getItem = false;
    failures.setItem = false;
  },
  seed(entries) {
    for (const [k, v] of Object.entries(entries)) data.set(k, v);
  },
  get: (key) => data.get(key),
  snapshot: () => Object.fromEntries(data),
  writes: () => [...writes],
  fail(op, on = true) {
    failures[op] = on;
  },
};
