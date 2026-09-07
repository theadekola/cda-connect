import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from '@/platform/react-native';
import { router, useLocalSearchParams } from '@/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from '@/platform/document-picker';
import { Ionicons } from '@/platform/icons';
import { api } from '@/lib/api';
import { Button, Card, Header, Input, Muted, Screen, SectionTitle, useAppTheme } from '@/components/UI';
import { formatAmount } from '@/lib/money';

type EvidenceFile = { uri: string; name: string; type: string };
async function upload(file: EvidenceFile) {
  const form = new FormData();
  if (Platform.OS === 'web') { const blob = await (await fetch(file.uri)).blob(); form.append('file', blob, file.name); }
  else form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
  return (await api.post('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.url as string;
}

export default function PayLevy() {
  const { id, ledgerId } = useLocalSearchParams<{ id: string; ledgerId: string }>();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<EvidenceFile | null>(null);
  const mine = useQuery<any>({ queryKey: ['finance-me', id], queryFn: async () => (await api.get(`/communities/${id}/finance/me`)).data });
  const levy = mine.data?.dues?.find((item: any) => item.Id === ledgerId);
  const outstanding = levy ? Math.max(0, Number(levy.AmountDue) - Number(levy.AmountPaid)) : 0;
  const compact = width < 390;

  async function pickEvidence() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['image/*', 'application/pdf'] });
      if (!result.canceled) { const selected = result.assets[0]; setFile({ uri: selected.uri, name: selected.name, type: selected.mimeType || 'application/octet-stream' }); }
    } catch { Alert.alert('Unable to choose file', 'Please check file permissions and try again.'); }
  }
  const submit = useMutation({
    mutationFn: async () => { if (!levy || !file) throw new Error('Payment evidence is required'); const evidenceUrl = await upload(file); return api.post(`/communities/${id}/finance/ledger/${ledgerId}/payment-submissions`, { amount: outstanding, paymentMethod: 'BANK_TRANSFER', reference: reference.trim() || undefined, evidenceUrl, note: note.trim() }); },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['finance-me', id] }); router.replace(`/community/${id}/my-financial-record` as any); Alert.alert('Evidence submitted', 'Your bank transfer evidence is awaiting administrator approval.'); },
    onError: (error: any) => Alert.alert('Submission failed', error.response?.data?.message || error.message),
  });

  return <Screen scroll contentStyle={styles.page}>
    <Header page title="Pay Levy" subtitle="Bank transfer with mandatory payment evidence" />
    {levy ? <>
      <Card><View style={[styles.summary, compact && styles.summaryStack]}><View style={styles.flex}><Text style={[styles.title, { color: palette.text }]}>{levy.PlanName}</Text><Muted>Due {levy.DueDate ? new Date(levy.DueDate).toLocaleDateString() : 'not set'}</Muted></View><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.amount, { color: palette.danger }]}>{levy.CurrencyCode} {formatAmount(outstanding)}</Text></View></Card>
      <SectionTitle>Payment method</SectionTitle>
      <Card style={styles.methods}><Method icon="business" title="Bank Transfer" body="Transfer to the community bank account" enabled palette={palette} compact={compact} /><Method icon="card-outline" title="Card Payment" body="Unavailable" palette={palette} compact={compact} /><Method icon="qr-code-outline" title="USSD" body="Unavailable" palette={palette} compact={compact} /><Method icon="phone-portrait-outline" title="Mobile Money" body="Unavailable" palette={palette} compact={compact} /></Card>
      <SectionTitle>Payment details</SectionTitle>
      <Card><Text style={[styles.label, { color: palette.text }]}>Reference / Transaction ID (optional)</Text><Input value={reference} onChangeText={setReference} placeholder="Enter bank transaction reference" autoCapitalize="characters" /><Text style={[styles.label, { color: palette.text }]}>Payment evidence *</Text><Pressable accessibilityRole="button" accessibilityLabel={file ? `Replace payment evidence ${file.name}` : 'Choose payment evidence'} onPress={pickEvidence} style={({ pressed }) => [styles.upload, { borderColor: file ? palette.success : palette.border, backgroundColor: palette.surface }, pressed && styles.pressed]}><Ionicons name={file ? 'checkmark-circle' : 'cloud-upload-outline'} size={34} color={file ? palette.success : palette.primary} /><Text numberOfLines={2} style={[styles.fileName, { color: palette.text }]}>{file?.name || 'Choose JPEG, PNG or PDF'}</Text><Muted style={styles.center}>Evidence is required before submission</Muted></Pressable><Text style={[styles.label, { color: palette.text }]}>Note (optional)</Text><Input multiline value={note} onChangeText={setNote} placeholder="Add payment information" style={styles.note} /><Button title="Submit Evidence for Approval" icon="paper-plane-outline" variant="success" disabled={!file || submit.isPending || outstanding <= 0} loading={submit.isPending} onPress={() => submit.mutate()} /></Card>
    </> : mine.isLoading ? <Muted>Loading levy…</Muted> : <Card><Muted>This levy assignment could not be found.</Muted><Button title="Return to My Financial Record" variant="secondary" onPress={() => router.replace(`/community/${id}/my-financial-record` as any)} /></Card>}
  </Screen>;
}

function Method({ icon, title, body, enabled = false, palette, compact }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; enabled?: boolean; palette: any; compact: boolean }) { return <View accessible accessibilityLabel={`${title}. ${enabled ? 'Selected' : 'Disabled'}`} style={[styles.method, compact && styles.methodCompact, { opacity: enabled ? 1 : .42, borderBottomColor: palette.border }]}><Ionicons name={enabled ? 'radio-button-on' : 'radio-button-off'} size={22} color={enabled ? palette.success : palette.muted} /><Ionicons name={icon} size={23} color={enabled ? palette.success : palette.muted} /><View style={styles.flex}><Text style={{ color: palette.text, fontWeight: '900' }}>{title}</Text><Muted>{body}</Muted></View>{!enabled ? <Text style={[styles.disabled, { color: palette.muted }]}>{compact ? 'Off' : 'Disabled'}</Text> : null}</View>; }

const styles = StyleSheet.create({ page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 2, paddingBottom: 120 }, flex: { flex: 1, minWidth: 0 }, summary: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }, summaryStack: { flexDirection: 'column', alignItems: 'stretch' }, title: { fontSize: 17, fontWeight: '900', flexShrink: 1 }, amount: { maxWidth: '100%', fontSize: 19, fontWeight: '900', textAlign: 'right' }, methods: { paddingVertical: 4 }, method: { width: '100%', minHeight: 70, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2 }, methodCompact: { gap: 8 }, disabled: { fontWeight: '800', flexShrink: 0 }, label: { fontWeight: '900', marginBottom: 7 }, upload: { width: '100%', minHeight: 135, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 15, padding: 14 }, pressed: { opacity: .75 }, fileName: { width: '100%', fontWeight: '900', textAlign: 'center' }, center: { textAlign: 'center' }, note: { minHeight: 90 } });
