import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, Input, Muted, Screen, TabBar, useAppTheme } from '@/components/UI';

export default function MeetingAttendance() {
  const { id, meetingId } = useLocalSearchParams<{ id: string; meetingId: string }>();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'members' | 'recent'>('members');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const q = useQuery<any>({ queryKey: ['meeting-attendance', meetingId], queryFn: async () => (await api.get(`/meetings/${meetingId}/attendance`)).data, refetchInterval: 30000 });
  const refresh = useMutation({ mutationFn: () => api.post(`/meetings/${meetingId}/attendance/code`), onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] }), onError: (error: any) => Alert.alert('Attendance unavailable', error.response?.data?.message || 'This meeting has ended.') });
  const mark = useMutation({ mutationFn: (value: { userId: string; status: string }) => api.post(`/meetings/${meetingId}/attendance/members/${value.userId}`, { status: value.status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] }), onError: (error: any) => Alert.alert('Unable to mark attendance', error.response?.data?.message || 'This meeting has ended.') });
  const end = useMutation({ mutationFn: () => api.post(`/meetings/${meetingId}/attendance/end`), onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] }) });
  const data = q.data;
  const people = useMemo(() => (data?.participants || []).filter((person: any) => `${person.FirstName} ${person.LastName} ${person.CardNumber || ''}`.toLowerCase().includes(search.toLowerCase()) && (tab === 'members' || person.CheckedInAt)).sort((a: any, b: any) => new Date(b.CheckedInAt || 0).getTime() - new Date(a.CheckedInAt || 0).getTime()), [data, search, tab]);

  if (q.isLoading) return <Screen><Muted>Loading attendance…</Muted></Screen>;
  if (!data) return <Screen><EmptyState icon="cloud-offline-outline" title="Attendance unavailable" body="The attendance information could not be loaded." /></Screen>;
  const meeting = data.meeting;
  const ended = now >= new Date(meeting.EndDateTime).getTime() || meeting.IsActive === false;
  const active = data.canManage && !ended;
  const present = data.participants.filter((person: any) => person.Status === 'PRESENT' || person.Status === 'LATE').length;
  const narrow = width < 390;

  return <Screen scroll contentStyle={styles.page}>
    <Card>
      <View style={styles.meetingRow}><View style={[styles.icon, { backgroundColor: palette.primarySoft }]}><Ionicons name="calendar-outline" size={26} color={palette.primary} /></View><View style={styles.flex}><Text style={[styles.meeting, { color: palette.text }]}>{new Date(meeting.StartDateTime).toLocaleString()} – {new Date(meeting.EndDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text><Muted>{meeting.Location || 'Online meeting'}</Muted></View></View>
      {data.canManage ? ended ? <View style={[styles.closed, { backgroundColor: palette.dangerSoft }]}><Ionicons name="lock-closed-outline" size={24} color={palette.danger} /><View style={styles.flex}><Text style={{ color: palette.danger, fontWeight: '900' }}>Attendance closed</Text><Muted>The meeting has ended. New check-ins and manual attendance changes are disabled.</Muted></View></View> : <><View style={[styles.codeCard, { backgroundColor: palette.primarySoft }]}><Text style={{ color: palette.primary, fontWeight: '900' }}>Meeting Code</Text><Text selectable adjustsFontSizeToFit numberOfLines={1} style={[styles.code, { color: palette.primary }]}>{meeting.AttendanceCode || '------'}</Text><Muted>Expires at {new Date(meeting.EndDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Muted></View><Button title="Refresh Code" icon="refresh-outline" loading={refresh.isPending} onPress={() => refresh.mutate()} /></> : null}
    </Card>

    {active ? <View style={[styles.actions, narrow && styles.stack]}><View style={styles.action}><Button title="Scan Member Card" variant="success" icon="qr-code-outline" onPress={() => router.push({ pathname: `/community/${id}/scan-card` as any, params: { meetingId } })} /></View><View style={styles.action}><Button title="Recent Check-ins" variant="secondary" icon="time-outline" onPress={() => setTab('recent')} /></View></View> : null}

    <Card style={[styles.summary, narrow && styles.summaryWrap]}><Stat value={data.participants.length} label="Members" color={palette.primary} /><Stat value={present} label="Present" color={palette.success} /><Stat value={data.participants.filter((person: any) => person.Status === 'LATE').length} label="Late" color={palette.warning} /><Stat value={data.participants.length - present} label="Not marked" color={palette.muted} /></Card>
    {data.canManage ? <Input placeholder="Search by name or member ID" value={search} onChangeText={setSearch} /> : null}
    <TabBar value={tab} onChange={setTab} items={[{key:'members',label:'All Members',icon:'people-outline'},{key:'recent',label:'Recent Check-ins',icon:'time-outline'}]}/>
    {people.map((person: any) => <Card key={person.UserId} style={styles.person}><Avatar name={`${person.FirstName} ${person.LastName}`} uri={person.ProfileImage} size={narrow ? 42 : 50} /><View style={styles.flex}><Text style={[styles.name, { color: palette.text }]}>{person.FirstName} {person.LastName}</Text><Muted>{person.CardNumber || 'Community member'}</Muted>{person.CheckedInAt ? <Muted>{new Date(person.CheckedInAt).toLocaleString()} · {person.CheckInMethod}</Muted> : null}</View>{person.Status ? <Badge text={person.Status} tone={person.Status === 'ABSENT' ? 'red' : person.Status === 'LATE' ? 'orange' : 'green'} /> : active ? <View style={styles.markButton}><Button title="Mark Present" variant="success" onPress={() => mark.mutate({ userId: person.UserId, status: 'PRESENT' })} /></View> : <Badge text="Not marked" tone="gray" />}</Card>)}
    {!people.length ? <EmptyState icon="people-outline" title="No participants" body={tab === 'recent' ? 'No members have checked in yet.' : 'No matching community members were found.'} /> : null}
    {active ? <Button title="End Attendance" variant="danger" icon="stop-outline" loading={end.isPending} onPress={() => Alert.alert('End attendance?', 'The meeting code will immediately stop accepting check-ins.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End', style: 'destructive', onPress: () => end.mutate() }])} /> : null}
  </Screen>;
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) { return <View style={styles.stat}><Text style={[styles.count, { color }]}>{value}</Text><Muted style={styles.statLabel}>{label}</Muted></View>; }

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 4, paddingBottom: 130 }, flex: { flex: 1, minWidth: 0 },
  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, meeting: { fontSize: 15, fontWeight: '900', flexShrink: 1 },
  codeCard: { borderRadius: 14, padding: 16, marginTop: 16, alignItems: 'center', width: '100%' }, code: { width: '100%', fontSize: 38, fontWeight: '900', letterSpacing: 8, marginVertical: 7, textAlign: 'center' }, closed: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, padding: 14, marginTop: 16 },
  actions: { width: '100%', flexDirection: 'row', gap: 10 }, stack: { flexDirection: 'column', gap: 0 }, action: { flex: 1, minWidth: 0 },
  summary: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 }, summaryWrap: { flexWrap: 'wrap' }, stat: { flex: 1, minWidth: 66, alignItems: 'center' }, count: { fontSize: 23, fontWeight: '900', textAlign: 'center' }, statLabel: { textAlign: 'center' },
  tabs: { width: '100%', flexDirection: 'row', marginBottom: 12 }, tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  person: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, name: { fontSize: 16, fontWeight: '900' }, markButton: { minWidth: 128, maxWidth: '100%' },
});
