"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage, displayError } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { pickBackup, saveBackup, shareBackup } from '@/data/backup-files';
import { inspectRecords } from '@/data/backup-format';
import { Action, backupService, useDataBackup } from '@/hooks/use-data-backup';

type ImportPreview = Awaited<ReturnType<typeof backupService.preview>>;
export default function DataBackupScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { restore, result, busy: globalBusy, available, unavailableReason } = useDataBackup();
  const [working, setWorking] = useState(false); const [message, setMessage] = useState('');
  const [exportText, setExportText] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<ImportPreview | null>(null); const [ack, setAck] = useState(false);
  const [filename, setFilename] = useState('');
  const busy = working || globalBusy;
  // Deduplicate display text only; differing counts and record errors stay distinct.
  const previewWarnings = incoming ? [...new Set([
    ...incoming.preview.warnings,
    ...incoming.currentPreview.errors.map((error) => appMessage("backup.preview.currentRecordWarning", { error: (error) })),
    ...incoming.currentPreview.warnings,
  ])] : [];
  const task = async (fn: () => Promise<void>) => {
    if (busy) return; setWorking(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(displayError(error, appLabel("data-backup.operationFailedYourDataHasNotBeenIntentionallyReplaced"))); }
    finally { setWorking(false); }
  };
  const capture = () => task(async () => {
    setIncoming(null); setExportText(null);
    const backup = await backupService.exportBackup(Constants.expoConfig?.version ?? '1.0.0');
    const report = inspectRecords(backup.payload.records); setExportText(JSON.stringify(backup));
    setMessage(`${report.restorable ? appLabel("data-backup.backupReadyForRestore") : appLabel("data-backup.lOSSLESSARCHIVEONLYUnsafeRecordsPreventNormalRestore")}\n${report.summary.join('\n')}\n${[...report.errors, ...report.warnings].slice(0, 20).join('\n')}`);
  });
  const pick = () => task(async () => {
    setIncoming(null); setAck(false); setExportText(null);
    const selected = await pickBackup(); if (selected === null) { setMessage(appLabel("data-backup.importCanceledNothingChanged")); return; }
    const preview = await backupService.preview(selected.text); setFilename(selected.name); setIncoming(preview);
  });
  const confirm = () => {
    if (!incoming || !ack || busy) return;
    Alert.alert(appLabel("data-backup.replaceAllCurrentData"), appLabel("data-backup.thisReplacesHabitsHistoryGoalsRoutinesProfileAndAchievementsItDoesNotMergeALocalRecoveryCopyWillBeKept"), [
      { get text(){return appLabel("data-backup.cancel");}, style: 'cancel' },
      { get text(){return appLabel("data-backup.replaceCurrentData");}, style: 'destructive', onPress: () => void task(async () => { if (await restore(JSON.stringify(incoming.backup), incoming.current.payload.records)) router.replace('/(tabs)/settings'); }) },
    ], { cancelable: true });
  };
  const saveRecovery = (share: boolean) => task(async () => {
    const text = await backupService.recoveryCopy(); if (!text) { setMessage(appLabel("data-backup.noRecoveryCopyIsStored")); return; }
    if (share) { await shareBackup(text); setMessage(appLabel("data-backup.shareSheetClosedCheckYourChosenDestinationThisDoesNotConfirmTheFileWasSaved")); }
    else setMessage(await saveBackup(text) ? appLabel("data-backup.recoveryCopySavedAndVerified") : appLabel("data-backup.saveCanceled"));
  });
  return <View style={styles.screen}><SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={appLabel("data-backup.backToSettings")}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => router.replace('/(tabs)/settings')}
        style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}>
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={Palette.text} />
        <Text style={styles.backText}>{appLabel("data-backup.back")}</Text>
      </Pressable>
    </View>
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">{appLabel("data-backup.dataBackup")}</Text>
      <Text style={styles.text}>{appLabel("data-backup.yourBackupsAreUnencryptedLocalJSONFilesTheyMayContainSensitiveHabitsPersonalRoutinesProfileAndAchievementHistoryKeepThemSomewherePrivateMOMENTUMHasNoAccountCloudBackendOrAutomaticUploadSharingWithAnotherAppOrCloudProviderIsYourChoice")}</Text>
      {!available ? <Text style={styles.text} accessibilityLiveRegion="polite">{unavailableReason}</Text> : <>
        <Action label={appLabel("data-backup.exportBackup")} disabled={busy} onPress={() => void capture()} />
        <Action label={appLabel("data-backup.importBackup")} disabled={busy} onPress={() => void pick()} />
        {working && <ActivityIndicator color={Palette.accent} accessibilityLabel={appLabel("data-backup.checkingBackupData")} />}
        {!!(message || result) && <Text style={styles.notice} accessibilityLiveRegion="polite" selectable>{message || result}</Text>}
        {exportText && <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.chooseADestination")}</Text>
          <Action label={appLabel("data-backup.saveToDevice")} disabled={busy} onPress={() => void task(async () => { setMessage(await saveBackup(exportText) ? appLabel("data-backup.backupSavedAndVerifiedInYourSelectedFolder") : appLabel("data-backup.saveCanceled")); })} />
          <Action label={appLabel("data-backup.shareBackup")} disabled={busy} onPress={() => void task(async () => { await shareBackup(exportText); setMessage(appLabel("data-backup.shareSheetClosedCheckYourChosenDestinationSavingIsNotConfirmed")); })} />
        </View>}
        {incoming && <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.reviewBeforeReplacing")}</Text>
          <Text style={styles.text}>{filename}</Text>
          <Text style={styles.text}>{appMessage("backup.preview.metadata", { createdAt: incoming.backup.createdAt, version: incoming.backup.app.version })}</Text>
          <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.incomingBackup")}</Text>
          {incoming.preview.summary.map((s, i) => <Text style={styles.text} key={i}>{s}</Text>)}
          <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.currentDeviceData")}</Text>
          {incoming.currentPreview.summary.map((s, i) => <Text style={styles.text} key={i}>{s}</Text>)}
          {previewWarnings.length > 0 && <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.dataNotes")}</Text>}
          {previewWarnings.map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
          <Text style={styles.warning}>{appLabel("data-backup.thisReplacesALLCurrentMOMENTUMDataIncludingDatesAndRecordsAbsentFromThisBackupItDoesNotMergeMultiKeyWritesAreNotAtomicAVerifiedRecoveryCopyWillBeKept")}</Text>
          <Action label={appLabel("data-backup.cancelImport")} disabled={busy} onPress={() => { setIncoming(null); setAck(false); }} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ack, disabled: busy }} disabled={busy} onPress={() => setAck(!ack)} style={styles.check}><Text style={styles.text}>{ack ? '☑' : '☐'} {appLabel("data-backup.iUnderstandThatMyCurrentDataWillBeReplaced")}</Text></Pressable>
          <Action label={appLabel("data-backup.replaceCurrentData")} danger disabled={busy || !ack} onPress={confirm} />
        </View>}
        <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{appLabel("data-backup.localRecoveryCopy")}</Text>
          <Text style={styles.text}>{appLabel("data-backup.afterRestoreThePreviousRawDataRemainsPrivatelyOnThisDeviceUnencryptedItCanIncludeUnreadableRecordsUninstallingOrClearingAppDataMayDeleteIt")}</Text>
          <Action label={appLabel("data-backup.saveRecoveryCopy")} disabled={busy} onPress={() => void saveRecovery(false)} />
          <Action label={appLabel("data-backup.shareRecoveryCopy")} disabled={busy} onPress={() => void saveRecovery(true)} />
          <Action label={appLabel("data-backup.removeRecoveryCopies")} danger disabled={busy} onPress={() => Alert.alert(appLabel("data-backup.removeLocalRecoveryCopies"), appLabel("data-backup.onlyCompletedRecoverySnapshotsWillBeRemovedKeepAnExternalBackupFirst"), [{ get text(){return appLabel("data-backup.cancel");}, style: 'cancel' }, { get text(){return appLabel("data-backup.removeCopies");}, style: 'destructive', onPress: () => void task(async () => { await backupService.removeRecoveryCopies(); setMessage(appLabel("data-backup.completedRecoveryCopiesRemovedCurrentAppDataWasNotChanged")); }) }])} />
        </View>
      </>}
    </ScrollView>
  </SafeAreaView></View>;
}
const createStyles = (Palette: AppPalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background }, safe: { flex: 1 },
  header: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 4, backgroundColor: Palette.background, borderBottomWidth: 1, borderBottomColor: Palette.border },
  back: { minHeight: 48, minWidth: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingRight: 16 },
  backText: { color: Palette.text, fontSize: 15, flexShrink: 1 }, dimmed: { opacity: 0.6 },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: 32 },
  title: { fontSize: 30, color: Palette.text, fontWeight: '700' }, heading: { color: Palette.text, fontSize: 18, fontWeight: '600' },
  text: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24 }, warning: { color: Palette.danger, fontSize: 16, lineHeight: 24 },
  notice: { color: Palette.text, fontSize: 16, lineHeight: 24, padding: 16, borderColor: Palette.border, borderWidth: 1, borderRadius: Radius.md },
  card: { backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.lg, padding: 16, gap: 16 }, check: { minHeight: 48, justifyContent: 'center', padding: 8 },
});
