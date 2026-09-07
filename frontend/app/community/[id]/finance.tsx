import { StyleSheet, Text, View, useWindowDimensions } from '@/platform/react-native';
import { useLocalSearchParams } from '@/router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Header, Muted, Screen, SectionTitle, useAppTheme } from '@/components/UI';
import { formatAmount } from '@/lib/money';

export default function Finance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const mine = useQuery<any>({ queryKey: ['finance-me', id], queryFn: async () => (await api.get(`/communities/${id}/finance/me`)).data });
  const admin = useQuery<any>({ queryKey: ['finance-summary', id], queryFn: async () => (await api.get(`/communities/${id}/finance/summary`)).data, retry: false });
  const compact = width < 390;
  return <Screen scroll contentStyle={styles.page}>
    <Header page title="Community Finances" subtitle="Dues, receipts, donations and payments" />
    {admin.data ? <><SectionTitle>Admin overview</SectionTitle><View style={[styles.amounts, compact && styles.stack]}><Amount label="Balance" currency="GBP" value={admin.data.totals.Balance} color={palette.success} /><Amount label="Outstanding dues" currency="GBP" value={admin.data.dues.OutstandingAmount} color={palette.danger} /></View></> : null}
    <SectionTitle>My dues</SectionTitle>
    {!mine.data?.dues?.length ? <EmptyState title="No dues assigned" body="When your community publishes a dues plan it will appear here." /> : mine.data.dues.map((due: any) => <Card key={due.Id}><View style={styles.top}><View style={styles.flex}><Text style={[styles.title, { color: palette.text }]}>{due.Year} {due.PlanName}</Text><Muted>Due {due.DueDate ? new Date(due.DueDate).toLocaleDateString() : 'not set'}</Muted></View><Badge text={due.Status} tone={due.Status === 'PAID' ? 'green' : 'orange'} /></View><View style={[styles.amounts, compact && styles.stack]}><Amount label="Paid" currency={due.CurrencyCode} value={due.AmountPaid} color={palette.success} /><Amount label="Outstanding" currency={due.CurrencyCode} value={Math.max(0, Number(due.AmountDue) - Number(due.AmountPaid))} color={palette.danger} /></View><Muted>Contact your CDA administrator for the approved payment method.</Muted></Card>)}
    <SectionTitle>Receipts</SectionTitle>{mine.data?.receipts?.map((receipt: any) => <Card key={receipt.Id}><View style={styles.top}><Text style={[styles.title, styles.flex, { color: palette.text }]}>{receipt.Description}</Text><Text style={[styles.receipt, { color: palette.text }]}>{receipt.CurrencyCode} {formatAmount(receipt.Amount)}</Text></View><Muted>{new Date(receipt.TransactionDate).toLocaleString()} · {receipt.Reference || receipt.TransactionType}</Muted></Card>)}
  </Screen>;
}

function Amount({ label, currency, value, color }: { label: string; currency: string; value: any; color: string }) { return <View style={styles.amount}><Muted>{label}</Muted><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.money, { color }]}>{currency} {formatAmount(value)}</Text></View>; }
const styles = StyleSheet.create({ page: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 120 }, flex: { flex: 1, minWidth: 0 }, top: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, title: { fontSize: 16, fontWeight: '900' }, amounts: { width: '100%', flexDirection: 'row', gap: 12, marginVertical: 16 }, stack: { flexDirection: 'column' }, amount: { flex: 1, minWidth: 0 }, money: { fontSize: 20, fontWeight: '900' }, receipt: { fontWeight: '900', flexShrink: 1 } });
