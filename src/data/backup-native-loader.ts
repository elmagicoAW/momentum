/** Never evaluate optional native packages while Router imports the layout.
 * Static import() paths remain visible to Metro. No checksum fallback exists. */
export class BackupRuntimeUnavailable extends Error {}
export function lazyBackupDependency<T>(name: string, importer: () => Promise<T>): () => Promise<T> {
  let loaded: Promise<T> | null = null;
  return () => {
    if (!loaded) loaded = Promise.resolve().then(importer).catch(() => {
      loaded = null;
      throw new BackupRuntimeUnavailable(`${name} is unavailable in this native runtime. Update Expo Go to a compatible SDK 58 build, or use a newly compiled SDK 58 development build. Do not uninstall or clear app data.`);
    });
    return loaded;
  };
}
export async function requireBackupCapabilities(names: string[], lookup?: (name: string) => unknown): Promise<void> {
  const optional = lookup ?? (await import('expo')).requireOptionalNativeModule;
  for (const name of names) if (!optional(name)) throw new BackupRuntimeUnavailable(`${name} is missing from this native app binary.`);
}
export const loadCrypto = lazyBackupDependency('ExpoCrypto (SHA-256)', async () => {
  // The package root also imports AES. Probe before evaluating its throwing
  // requireNativeModule calls; expected unavailability must not trigger RedBox.
  await requireBackupCapabilities(['ExpoCrypto', 'ExpoCryptoAES']);
  return import('expo-crypto');
});
export async function hashBackupNative(text: string): Promise<string> {
  const Crypto = await loadCrypto();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}
export const loadBackupFiles = lazyBackupDependency('Expo FileSystem', async () => {
  await requireBackupCapabilities(['FileSystem']);
  return import('./backup-native-implementation');
});
export const loadSharing = lazyBackupDependency('Expo Sharing', async () => {
  await requireBackupCapabilities(['ExpoSharing']);
  return import('expo-sharing');
});
