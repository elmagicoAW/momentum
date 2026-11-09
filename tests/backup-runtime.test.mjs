import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { checkBackupRuntime } from '../src/data/backup-runtime-check.ts';
import { lazyBackupDependency, BackupRuntimeUnavailable, requireBackupCapabilities } from '../src/data/backup-native-loader.ts';

// Reproduce a native binary missing optional modules without installing RN in
// Node or pretending that a JS package provides the missing Android binary.
let nativePackageImports = 0;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'expo') return { url: 'data:text/javascript,export const requireOptionalNativeModule = () => null;', shortCircuit: true };
  if (['expo-crypto','expo-file-system','expo-sharing'].includes(specifier)) {
    nativePackageImports++;
    throw new Error('A missing native package must be probed before evaluation');
  }
  return next(specifier, context);
} });
const hash = async (text) => createHash('sha256').update(text).digest('hex');
test('native backup facade imports with ALL optional native modules absent', async () => {
  const facade = await import('../src/data/backup-files.native.ts');
  assert.equal(nativePackageImports, 0);
  await assert.rejects(facade.hashBackup('abc'), BackupRuntimeUnavailable);
  await assert.rejects(facade.journalFiles.list(), BackupRuntimeUnavailable);
  await assert.rejects(facade.shareBackup('{}'), BackupRuntimeUnavailable);
  assert.equal(nativePackageImports, 0);
});
test('lazy dependencies defer execution, coalesce loads and safely reject/retry failures', async () => {
  let calls = 0;
  const load = lazyBackupDependency('Test native dependency', async () => { if (++calls === 1) throw new Error('absent'); return 'loaded'; });
  assert.equal(calls,0);
  await assert.rejects(load(),/compatible SDK 58/);
  assert.deepEqual(await Promise.all([load(),load()]),['loaded','loaded']);
  assert.equal(calls,2);
});
test('optional lookup rejects missing ExpoCrypto and package-root AES dependency before evaluation',async()=>{
  await assert.rejects(requireBackupCapabilities(['ExpoCrypto','ExpoCryptoAES'],()=>null),/ExpoCrypto/);
  await assert.rejects(requireBackupCapabilities(['ExpoCrypto','ExpoCryptoAES'],n=>n==='ExpoCrypto'?{}:null),/ExpoCryptoAES/);
  await requireBackupCapabilities(['ExpoCrypto','ExpoCryptoAES'],()=>({}));
});
test('missing crypto disables only backups when file inspection proves no recovery evidence',async()=>{
  const unavailable=await checkBackupRuntime(async()=>[],async()=>{throw new Error("Cannot find native module 'ExpoCrypto'");});
  assert.equal(unavailable.kind,'unavailable');assert.match(unavailable.message,/rest of MOMENTUM can continue/);
});
test('missing crypto with ANY recovery evidence remains blocked; no integrity bypass',async()=>{
  for(const name of ['restore-123.before','restore-123.prepared','restore-123.committed','restore-123.settled']){
    const state=await checkBackupRuntime(async()=>[name],async()=>{throw new Error('native module unavailable');});
    assert.equal(state.kind,'blocked');assert.match(state.message,/no recovery verification has been skipped/);
  }
});
test('uninspectable filesystem blocks even if crypto works; false/weak hash cannot authorize recovery',async()=>{
  let cryptoCalled=false;
  assert.equal((await checkBackupRuntime(async()=>{throw new Error('FileSystem absent');},async()=>{cryptoCalled=true;return '';})).kind,'blocked');
  assert.equal(cryptoCalled,false);
  for(const result of ['crc32','0'.repeat(64),'']){
    assert.equal((await checkBackupRuntime(async()=>[],async()=>result)).kind,'unavailable');
    assert.equal((await checkBackupRuntime(async()=>['journal'],async()=>result)).kind,'blocked');
  }
  assert.equal((await checkBackupRuntime(async()=>['journal'],hash)).kind,'ready');
});
