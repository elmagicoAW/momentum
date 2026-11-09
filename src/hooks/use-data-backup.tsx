import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { Radius, Spacing } from '@/constants/theme';
import { backupSupported, hashBackup, journalFiles, saveBackup, shareBackup } from '@/data/backup-files';
import { createBackupService, RecoveryBlocked } from '@/data/backup-service';
import type { RawRecord } from '@/data/backup-keys';
import { persistence } from '@/data/persistence-coordinator';
import { checkBackupRuntime, type BackupRuntimeState } from '@/data/backup-runtime-check';

export const backupService = createBackupService(AsyncStorage, journalFiles, hashBackup);
type BackupContextValue = {
  busy: boolean; result: string; available: boolean; unavailableReason: string;
  restore: (text: string, expected: RawRecord[]) => Promise<boolean>;
};
const BackupContext = createContext<BackupContextValue | null>(null);
type BootResult = { changed: boolean; runtime: BackupRuntimeState };
let startup: Promise<BootResult> | null = null;
async function checkAndRecover(): Promise<BootResult> {
  const runtime = await checkBackupRuntime(() => journalFiles.list(), hashBackup);
  if (runtime.kind === 'blocked') throw new RecoveryBlocked(runtime.message);
  const changed = runtime.kind === 'ready' ? await backupService.recover() : false;
  persistence.release();
  return { changed, runtime };
}
const boot = () => {
  if (!startup) startup = (async () => {
    persistence.freeze();
    return checkAndRecover();
  })();
  return startup;
};

export function DataBackupProvider({ children }: { children: ReactNode }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'applying' | 'blocked'>(backupSupported ? 'loading' : 'ready');
  const [epoch, setEpoch] = useState(() => persistence.generation());
  const [unavailableReason, setUnavailableReason] = useState(backupSupported ? '' : 'Manual Data & Backup is available in the Android/iOS app.');
  const [error, setError] = useState(''); const [result, setResult] = useState(''); const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!backupSupported) return;
    let alive = true;
    void boot().then(({ changed, runtime }) => {
      if (!alive) return;
      setUnavailableReason(runtime.kind === 'unavailable' ? runtime.message : '');
      setEpoch(persistence.generation()); if (changed) setResult('Interrupted restore was recovered and verified.'); setPhase('ready');
    }).catch((cause: unknown) => { if (alive) { setError(cause instanceof RecoveryBlocked ? cause.message : 'Recovery could not be verified. Editing remains blocked. Retry recovery or save the available recovery copy. Do not uninstall or clear app data.'); setPhase('blocked'); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (phase === 'ready') return;
    void SplashScreen.hideAsync().catch(() => undefined);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase]);
  const restore = useCallback(async (text: string, expected: RawRecord[]) => {
    if (unavailableReason) throw new Error(unavailableReason);
    setPhase('applying'); setResult('');
    try {
      const outcome = await backupService.restore(text, expected);
      setEpoch(persistence.generation()); setResult(outcome.message); setPhase('ready');
      return true;
    } catch (cause) {
      if (cause instanceof RecoveryBlocked) { setError(cause.message); setPhase('blocked'); return false; }
      else { setPhase('ready'); throw cause; }
    }
  }, [unavailableReason]);
  const recover = async () => {
    if (recovering) return; setRecovering(true);
    try {
      if (persistence.available()) persistence.freeze();
      const recovered = await checkAndRecover();
      startup = Promise.resolve(recovered); setUnavailableReason(recovered.runtime.kind === 'unavailable' ? recovered.runtime.message : '');
      setEpoch(persistence.generation()); setResult(recovered.changed ? 'Previous data recovered and verified.' : ''); setPhase('ready');
    } catch (cause) { setError(cause instanceof RecoveryBlocked ? cause.message : 'Recovery still cannot be verified. Keep app data intact and retry.'); }
    finally { setRecovering(false); }
  };
  const saveRecovery = async (share: boolean) => {
    if (recovering) return; setRecovering(true);
    try {
      const text = await backupService.recoveryCopy(); if (!text) throw new Error('No verified recovery copy is available.');
      if (share) { await shareBackup(text); setError('Share sheet closed. Confirm the recovery file was saved in your chosen destination. Editing remains blocked.'); }
      else setError(await saveBackup(text) ? 'Recovery copy saved and verified. Editing remains blocked until recovery succeeds.' : 'Save canceled. Editing remains blocked.');
    } catch { setError('Could not save a verified recovery copy. Keep app data intact and retry.'); }
    finally { setRecovering(false); }
  };
  return (
    <BackupContext.Provider value={{ busy: phase !== 'ready', result, restore, available: backupSupported && !unavailableReason, unavailableReason }}>
      {(phase === 'ready' || phase === 'applying') && <View style={styles.safe} importantForAccessibility={phase === 'applying' ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={phase === 'applying'}><Fragment key={epoch}>{children}</Fragment></View>}
      {phase !== 'ready' && (
        <View style={styles.overlay} accessibilityViewIsModal>
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title} accessibilityRole="header">{phase === 'blocked' ? 'Data recovery required' : phase === 'applying' ? 'Restoring your backup' : 'Checking local data'}</Text>
              {phase !== 'blocked' && <ActivityIndicator color={Palette.accent} accessibilityLabel="Please wait for data verification" />}
              <Text style={styles.text} accessibilityLiveRegion="assertive">{phase === 'blocked' ? error : 'Editing is paused while saved data is verified. Multi-key storage is not atomic; recovery files protect interrupted replacements.'}</Text>
              {phase === 'blocked' && <>
                <Text style={styles.text}>Recovery files are unencrypted and may contain personal routines.</Text>
                <Action label="Retry recovery" disabled={recovering} onPress={() => void recover()} />
                <Action label="Save recovery copy to device" disabled={recovering} onPress={() => void saveRecovery(false)} />
                <Action label="Share recovery copy" disabled={recovering} onPress={() => void saveRecovery(true)} />
              </>}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </BackupContext.Provider>
  );
}
export function useDataBackup() {
  const value = useContext(BackupContext); if (!value) throw new Error('Missing DataBackupProvider'); return value;
}
export function Action({ label, onPress, disabled = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { styles } = useAppStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, danger && styles.danger, (disabled || pressed) && { opacity: 0.6 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const createStyles = (Palette: AppPalette) => StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: Palette.background, zIndex: 1000 }, safe: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 800, alignSelf: 'center' },
  title: { color: Palette.text, fontWeight: '700', fontSize: 25 }, text: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24 },
  button: { minHeight: 48, borderRadius: Radius.md, backgroundColor: Palette.accentSoft, borderWidth: 1, borderColor: Palette.accent, padding: 14, justifyContent: 'center' },
  danger: { backgroundColor: Palette.dangerSoft, borderColor: Palette.danger }, buttonText: { color: Palette.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
