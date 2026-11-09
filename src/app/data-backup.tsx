import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    ...incoming.currentPreview.errors.map((error) => `Current device data: ${error}. The original raw record will be preserved in the recovery copy.`),
    ...incoming.currentPreview.warnings,
  ])] : [];
  const task = async (fn: () => Promise<void>) => {
    if (busy) return; setWorking(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operation failed. Your data has not been intentionally replaced.'); }
    finally { setWorking(false); }
  };
  const capture = () => task(async () => {
    setIncoming(null); setExportText(null);
    const backup = await backupService.exportBackup(Constants.expoConfig?.version ?? '1.0.0');
    const report = inspectRecords(backup.payload.records); setExportText(JSON.stringify(backup));
    setMessage(`${report.restorable ? 'Backup ready for restore.' : 'LOSSLESS ARCHIVE ONLY — unsafe records prevent normal restore.'}\n${report.summary.join('\n')}\n${[...report.errors, ...report.warnings].slice(0, 20).join('\n')}`);
  });
  const pick = () => task(async () => {
    setIncoming(null); setAck(false); setExportText(null);
    const selected = await pickBackup(); if (selected === null) { setMessage('Import canceled. Nothing changed.'); return; }
    const preview = await backupService.preview(selected.text); setFilename(selected.name); setIncoming(preview);
  });
  const confirm = () => {
    if (!incoming || !ack || busy) return;
    Alert.alert('Replace all current data?', 'This replaces habits, history, goals, routines, profile and achievements. It does not merge. A local recovery copy will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace current data', style: 'destructive', onPress: () => void task(async () => { if (await restore(JSON.stringify(incoming.backup), incoming.current.payload.records)) router.replace('/(tabs)/settings'); }) },
    ], { cancelable: true });
  };
  const saveRecovery = (share: boolean) => task(async () => {
    const text = await backupService.recoveryCopy(); if (!text) { setMessage('No recovery copy is stored.'); return; }
    if (share) { await shareBackup(text); setMessage('Share sheet closed. Check your chosen destination; this does not confirm the file was saved.'); }
    else setMessage(await saveBackup(text) ? 'Recovery copy saved and verified.' : 'Save canceled.');
  });
  return <View style={styles.screen}><SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Settings"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => router.replace('/(tabs)/settings')}
        style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}>
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={Palette.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">Data & Backup</Text>
      <Text style={styles.text}>Your backups are unencrypted local JSON files. They may contain sensitive habits, personal routines, profile and achievement history. Keep them somewhere private. MOMENTUM has no account, cloud backend or automatic upload. Sharing with another app or cloud provider is your choice.</Text>
      {!available ? <Text style={styles.text} accessibilityLiveRegion="polite">{unavailableReason}</Text> : <>
        <Action label="Export Backup" disabled={busy} onPress={() => void capture()} />
        <Action label="Import Backup" disabled={busy} onPress={() => void pick()} />
        {working && <ActivityIndicator color={Palette.accent} accessibilityLabel="Checking backup data" />}
        {!!(message || result) && <Text style={styles.notice} accessibilityLiveRegion="polite" selectable>{message || result}</Text>}
        {exportText && <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">Choose a destination</Text>
          <Action label="Save to device" disabled={busy} onPress={() => void task(async () => { setMessage(await saveBackup(exportText) ? 'Backup saved and verified in your selected folder.' : 'Save canceled.'); })} />
          <Action label="Share backup" disabled={busy} onPress={() => void task(async () => { await shareBackup(exportText); setMessage('Share sheet closed. Check your chosen destination; saving is not confirmed.'); })} />
        </View>}
        {incoming && <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">Review before replacing</Text>
          <Text style={styles.text}>{filename}</Text>
          <Text style={styles.text}>Created {incoming.backup.createdAt}{'\n'}MOMENTUM {incoming.backup.app.version}</Text>
          <Text style={styles.heading} accessibilityRole="header">Incoming backup</Text>
          {incoming.preview.summary.map((s, i) => <Text style={styles.text} key={i}>{s}</Text>)}
          <Text style={styles.heading} accessibilityRole="header">Current device data</Text>
          {incoming.currentPreview.summary.map((s, i) => <Text style={styles.text} key={i}>{s}</Text>)}
          {previewWarnings.length > 0 && <Text style={styles.heading} accessibilityRole="header">Data notes</Text>}
          {previewWarnings.map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
          <Text style={styles.warning}>This replaces ALL current MOMENTUM data, including dates and records absent from this backup. It does not merge. Multi-key writes are not atomic. A verified recovery copy will be kept.</Text>
          <Action label="Cancel import" disabled={busy} onPress={() => { setIncoming(null); setAck(false); }} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ack, disabled: busy }} disabled={busy} onPress={() => setAck(!ack)} style={styles.check}><Text style={styles.text}>{ack ? '☑' : '☐'} I understand that my current data will be replaced.</Text></Pressable>
          <Action label="Replace current data" danger disabled={busy || !ack} onPress={confirm} />
        </View>}
        <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">Local recovery copy</Text>
          <Text style={styles.text}>After restore, the previous raw data remains privately on this device, unencrypted. It can include unreadable records. Uninstalling or clearing app data may delete it.</Text>
          <Action label="Save recovery copy" disabled={busy} onPress={() => void saveRecovery(false)} />
          <Action label="Share recovery copy" disabled={busy} onPress={() => void saveRecovery(true)} />
          <Action label="Remove recovery copies" danger disabled={busy} onPress={() => Alert.alert('Remove local recovery copies?', 'Only completed recovery snapshots will be removed. Keep an external backup first.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove copies', style: 'destructive', onPress: () => void task(async () => { await backupService.removeRecoveryCopies(); setMessage('Completed recovery copies removed. Current app data was not changed.'); }) }])} />
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
