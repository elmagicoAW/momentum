import { appLabel, withErrorMessage, displayError } from '@/i18n/app-copy';
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
  if (runtime.kind === 'blocked') throw withErrorMessage(new RecoveryBlocked(runtime.message), {key: 'recovery.runtimeBlocked', params: {reason: runtime.message}});
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
  const [unavailableReason, setUnavailableReason] = useState(backupSupported ? '' : appLabel("use-data-backup.manualDataBackupIsAvailableInTheAndroidIOSApp"));
  const [error, setError] = useState(''); const [result, setResult] = useState(''); const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!backupSupported) return;
    let alive = true;
    void boot().then(({ changed, runtime }) => {
      if (!alive) return;
      setUnavailableReason(runtime.kind === 'unavailable' ? runtime.message : '');
      setEpoch(persistence.generation()); if (changed) setResult(appLabel("use-data-backup.interruptedRestoreWasRecoveredAndVerified")); setPhase('ready');
    }).catch((cause: unknown) => { if (alive) { setError(cause instanceof RecoveryBlocked ? displayError(cause, appLabel("use-data-backup.recoveryCouldNotBeVerifiedEditingRemainsBlockedRetryRecoveryOrSaveTheAvailableRecoveryCopyDoNotUninstallOrClearAppData")) : appLabel("use-data-backup.recoveryCouldNotBeVerifiedEditingRemainsBlockedRetryRecoveryOrSaveTheAvailableRecoveryCopyDoNotUninstallOrClearAppData")); setPhase('blocked'); } });
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
      if (cause instanceof RecoveryBlocked) { setError(displayError(cause, appLabel('use-data-backup.recoveryCouldNotBeVerifiedEditingRemainsBlockedRetryRecoveryOrSaveTheAvailableRecoveryCopyDoNotUninstallOrClearAppData'))); setPhase('blocked'); return false; }
      else { setPhase('ready'); throw cause; }
    }
  }, [unavailableReason]);
  const recover = async () => {
    if (recovering) return; setRecovering(true);
    try {
      if (persistence.available()) persistence.freeze();
      const recovered = await checkAndRecover();
      startup = Promise.resolve(recovered); setUnavailableReason(recovered.runtime.kind === 'unavailable' ? recovered.runtime.message : '');
      setEpoch(persistence.generation()); setResult(recovered.changed ? appLabel("use-data-backup.previousDataRecoveredAndVerified") : ''); setPhase('ready');
    } catch (cause) { setError(cause instanceof RecoveryBlocked ? displayError(cause, appLabel("use-data-backup.recoveryStillCannotBeVerifiedKeepAppDataIntactAndRetry")) : appLabel("use-data-backup.recoveryStillCannotBeVerifiedKeepAppDataIntactAndRetry")); }
    finally { setRecovering(false); }
  };
  const saveRecovery = async (share: boolean) => {
    if (recovering) return; setRecovering(true);
    try {
      const text = await backupService.recoveryCopy(); if (!text) throw withErrorMessage(new Error('No verified recovery copy is available.'), { key: "use-data-backup.noVerifiedRecoveryCopyIsAvailable" });
      if (share) { await shareBackup(text); setError(appLabel("use-data-backup.shareSheetClosedConfirmTheRecoveryFileWasSavedInYourChosenDestinationEditingRemainsBlocked")); }
      else setError(await saveBackup(text) ? appLabel("use-data-backup.recoveryCopySavedAndVerifiedEditingRemainsBlockedUntilRecoverySucceeds") : appLabel("use-data-backup.saveCanceledEditingRemainsBlocked"));
    } catch { setError(appLabel("use-data-backup.couldNotSaveAVerifiedRecoveryCopyKeepAppDataIntactAndRetry")); }
    finally { setRecovering(false); }
  };
  return (
    <BackupContext.Provider value={{ busy: phase !== 'ready', result, restore, available: backupSupported && !unavailableReason, unavailableReason }}>
      {(phase === 'ready' || phase === 'applying') && <View style={styles.safe} importantForAccessibility={phase === 'applying' ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={phase === 'applying'}><Fragment key={epoch}>{children}</Fragment></View>}
      {phase !== 'ready' && (
        <View style={styles.overlay} accessibilityViewIsModal>
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title} accessibilityRole="header">{phase === 'blocked' ? appLabel("use-data-backup.dataRecoveryRequired") : phase === 'applying' ? appLabel("use-data-backup.restoringYourBackup") : appLabel("use-data-backup.checkingLocalData")}</Text>
              {phase !== 'blocked' && <ActivityIndicator color={Palette.accent} accessibilityLabel={appLabel("use-data-backup.pleaseWaitForDataVerification")} />}
              <Text style={styles.text} accessibilityLiveRegion="assertive">{phase === 'blocked' ? error : appLabel("use-data-backup.editingIsPausedWhileSavedDataIsVerifiedMultiKeyStorageIsNotAtomicRecoveryFilesProtectInterruptedReplacements")}</Text>
              {phase === 'blocked' && <>
                <Text style={styles.text}>{appLabel("use-data-backup.recoveryFilesAreUnencryptedAndMayContainPersonalRoutines")}</Text>
                <Action label={appLabel("use-data-backup.retryRecovery")} disabled={recovering} onPress={() => void recover()} />
                <Action label={appLabel("use-data-backup.saveRecoveryCopyToDevice")} disabled={recovering} onPress={() => void saveRecovery(false)} />
                <Action label={appLabel("use-data-backup.shareRecoveryCopy")} disabled={recovering} onPress={() => void saveRecovery(true)} />
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
