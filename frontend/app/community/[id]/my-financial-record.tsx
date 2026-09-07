import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from '@/platform/react-native';
import { router, useLocalSearchParams } from '@/router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@/platform/icons';

import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Muted, Screen, TabBar, useAppTheme } from '@/components/UI';
import { AttachmentPreview, type Attachment } from '@/components/AttachmentPreview';

type Tab = 'pending' | 'paid' | 'all';

export default function MyFinancialRecord() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<Tab>('pending');
  const [preview, setPreview] = useState<Attachment>(null);

  const query = useQuery<any>({
    queryKey: ['finance-me', id],
    queryFn: async () => (await api.get(`/communities/${id}/finance/me`)).data,
    enabled: Boolean(id),
  });

  const all = query.data?.dues ?? [];
  const items =
    tab === 'all'
      ? all
      : all.filter((item: any) => (tab === 'paid' ? item.Status === 'PAID' : item.Status !== 'PAID'));
  const outstanding = all.reduce(
    (total: number, item: any) =>
      total + Math.max(0, Number(item.AmountDue) - Number(item.AmountPaid)),
    0,
  );

  return (
    <Screen scroll contentStyle={styles.page}>
      <Card style={[styles.hero, { backgroundColor: palette.dangerSoft }]}>
        <Muted>Total outstanding</Muted>
        <Text style={[styles.total, { color: palette.danger }]}>
          NGN {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
        <Muted>{all.filter((item: any) => item.Status !== 'PAID').length} levy payment(s) pending</Muted>
      </Card>

      <TabBar value={tab} onChange={setTab} items={[{key:'pending',label:'Pending',icon:'time-outline'},{key:'paid',label:'Paid',icon:'checkmark-circle-outline'},{key:'all',label:'All',icon:'list-outline'}]}/>

      {query.isLoading ? (
        <Muted>Loading your levies…</Muted>
      ) : query.isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Unable to load financial records"
          body="Check your connection and pull down to try again."
        />
      ) : !items.length ? (
        <EmptyState
          icon="receipt-outline"
          title={`No ${tab} levies`}
          body="Levies assigned to your account will appear here automatically."
        />
      ) : (
        items.map((item: any) => (
          <View
            key={item.Id}
          >
            <Card>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: palette.successSoft }]}>
                  <Ionicons name="business-outline" size={24} color={palette.success} />
                </View>
                <View style={styles.details}>
                  <Text style={[styles.title, { color: palette.text }]}>{item.PlanName}</Text>
                  <Muted>
                    Due {item.DueDate ? new Date(item.DueDate).toLocaleDateString() : 'date not set'} ·{' '}
                    {item.Frequency?.replace('_', ' ')}
                  </Muted>
                  <Text
                    style={[
                      styles.money,
                      { color: item.Status === 'PAID' ? palette.success : palette.danger },
                    ]}
                  >
                    {item.CurrencyCode} {Number(item.AmountDue).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={styles.status}>
                  <Badge
                    text={item.SubmissionStatus === 'PENDING' ? 'AWAITING APPROVAL' : item.Status}
                    tone={
                      item.Status === 'PAID'
                        ? 'green'
                        : item.SubmissionStatus === 'PENDING'
                          ? 'orange'
                          : 'red'
                    }
                  />
                  {item.EvidenceUrl ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`View evidence for ${item.PlanName}`} onPress={() => setPreview({ url: item.EvidenceUrl, title: `${item.PlanName} payment evidence` })} style={[styles.evidenceButton, { borderColor: palette.primary }]}>
                      <Ionicons name="eye-outline" size={15} color={palette.primary} />
                      <Text style={[styles.evidenceText, { color: palette.primary }]}>View evidence</Text>
                    </Pressable>
                  ) : null}
                  {item.Status !== 'PAID' && item.SubmissionStatus !== 'PENDING' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Pay ${item.PlanName}`} onPress={() => router.push(`/community/${id}/pay-levy/${item.Id}` as any)}><Text style={{ color: palette.primary, fontWeight: '900' }}>Pay now</Text></Pressable>
                  ) : null}
                </View>
              </View>
            </Card>
          </View>
        ))
      )}
      <AttachmentPreview attachment={preview} onClose={() => setPreview(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 120 },
  hero: { padding: 20 },
  total: { fontSize: 30, fontWeight: '900', marginVertical: 5 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 14 },
  tab: {
    flex: 1,
    minHeight: 48,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0 },
  status: { maxWidth: '34%', alignItems: 'flex-end', gap: 8 },
  evidenceButton:{minHeight:30,borderWidth:1,borderRadius:15,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:4},
  evidenceText:{fontSize:10.5,fontWeight:'900'},
  title: { fontSize: 16, fontWeight: '900' },
  money: { fontSize: 18, fontWeight: '900', marginTop: 8 },
});
