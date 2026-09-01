import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Header, Muted, Screen, SectionTitle, useAppTheme } from '@/components/UI';
import { api } from '@/lib/api';

export default function Analytics() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useAppTheme();
  const query = useQuery<any>({ queryKey: ['analytics', id], queryFn: async () => (await api.get(`/communities/${id}/analytics`)).data, retry: false });
  const analytics = query.data;
  if (!analytics) return <Screen><Header title="Admin Analytics"/><Muted>{query.error ? 'Analytics requires administrator permission.' : 'Loading analytics…'}</Muted></Screen>;

  const Metric = ({ label, value }: { label: string; value: string | number }) => <Card style={styles.metric}><Muted>{label}</Muted><Text style={[styles.value, { color: palette.text }]}>{value}</Text></Card>;
  return <Screen scroll>
    <Muted style={styles.intro}>Operational metrics that help administrators take action</Muted>
    <View style={styles.grid}>
      <Metric label="Members" value={analytics.members.count}/><Metric label="New this month" value={`+${analytics.members.new30d}`}/><Metric label="Monthly active" value={`${analytics.monthlyActivePercent}%`}/><Metric label="Meeting RSVP" value={`${analytics.meetingRsvpPercent}%`}/><Metric label="Poll participation" value={`${analytics.pollParticipationPercent}%`}/><Metric label="Posts and messages (30 days)" value={analytics.postMessageCount30d}/><Metric label="Open issues" value={analytics.issues.open}/><Metric label="Resolved (30 days)" value={analytics.issues.resolved30d}/>
    </View>
    <SectionTitle>Community health</SectionTitle>
    <Card><Text style={[styles.health, { color: palette.primary }]}>{analytics.health.overall} / 100</Text>{[['Engagement', analytics.health.engagement], ['Meeting activity', analytics.health.meetingActivity], ['Issue resolution', analytics.health.issueResolution], ['Participation', analytics.health.participation], ['Administrator response', analytics.health.adminResponse]].map(([name, value]: any) => <View key={name} style={styles.score}><Text style={[styles.scoreLabel, { color: palette.text }]}>{name}</Text><Text style={[styles.scoreValue, { color: palette.text }]}>{value}%</Text></View>)}<Muted style={styles.explanation}>{analytics.health.explanation}</Muted></Card>
  </Screen>;
}

const styles = StyleSheet.create({ intro: { marginBottom: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }, metric: { width: '48.5%', minHeight: 108, marginBottom: 0, justifyContent: 'space-between' }, value: { fontSize: 24, fontWeight: '900', marginTop: 5 }, health: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 15 }, score: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }, scoreLabel: { fontWeight: '700' }, scoreValue: { fontWeight: '900' }, explanation: { marginTop: 12 } });
