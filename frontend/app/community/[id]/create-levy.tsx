import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { AmountInput, Avatar, Button, Card, Header, Input, Muted, Screen, useAppTheme } from '@/components/UI';
import { DateField } from '@/components/DateField';
import { amountNumber } from '@/lib/money';

type Member = { UserId: string; FirstName: string; LastName: string; Email: string; ProfileImage?: string };
type Audience = 'ALL' | 'SELECTED';

export default function CreateLevy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [frequency, setFrequency] = useState('ONE_TIME');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const members = useQuery<Member[]>({ queryKey: ['members', id], queryFn: async () => (await api.get(`/communities/${id}/members`)).data });
  const save = useMutation({
    mutationFn: () => api.post(`/communities/${id}/finance/dues-plans`, { name: name.trim(), description: description.trim(), amount: amountNumber(amount), currencyCode: 'NGN', year: new Date(dueDate).getFullYear(), dueDate, frequency, audienceType: audience, memberIds: selected }),
    onSuccess: () => { Alert.alert('Levy created', 'The levy has been assigned to the selected members.'); router.replace(`/community/${id}/financial-record` as any); },
    onError: (error: any) => Alert.alert('Unable to create levy', error.response?.data?.message || error.message),
  });
  const chooseFrequency = () => Alert.alert('Frequency', 'Select how often this levy applies', [...['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL'].map(value => ({ text: value.replace('_', ' '), onPress: () => setFrequency(value) })), { text: 'Cancel', style: 'cancel' }]);
  const chooseAudience = () => Alert.alert('Assign levy to', 'Choose the levy recipients', [{ text: 'All Members', onPress: () => setAudience('ALL') }, { text: 'Selected Members', onPress: () => { setAudience('SELECTED'); setShowMembers(true); } }, { text: 'Cancel', style: 'cancel' }]);
  const valid = name.trim().length > 1 && description.trim().length > 1 && amountNumber(amount) > 0 && !Number.isNaN(new Date(dueDate).getTime()) && (audience === 'ALL' || selected.length > 0);
  const compact = width < 390;

  return <Screen scroll contentStyle={styles.page}>
    <Header page title="Create Levy" subtitle="Assign a financial obligation to all or selected members" />
    <Card style={styles.form}>
      <Label text="Levy name *" color={palette.text} /><Input value={name} onChangeText={setName} placeholder="e.g. Community Development Levy" />
      <Label text="Description *" color={palette.text} /><Input multiline value={description} onChangeText={setDescription} placeholder="What this levy funds" style={styles.description} />
      <Label text="Amount (NGN) *" color={palette.text} /><AmountInput value={amount} onChangeText={setAmount} placeholder="e.g. 10,000" accessibilityLabel="Levy amount in Nigerian naira" />
      <Label text="Due date *" color={palette.text} /><DateField value={dueDate} onChange={setDueDate} minimumDate={new Date()} />
      <Label text="Frequency *" color={palette.text} /><Selector value={frequency.replace('_', ' ')} onPress={chooseFrequency} palette={palette} />
      <Label text="Recipients *" color={palette.text} /><Selector value={audience === 'ALL' ? 'All Members' : `${selected.length} Selected Members`} onPress={chooseAudience} palette={palette} />
      <Button title="Create Levy" icon="checkmark-circle-outline" variant="success" disabled={!valid || save.isPending} loading={save.isPending} onPress={() => save.mutate()} />
    </Card>
    <Modal visible={showMembers} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembers(false)}><Screen scroll contentStyle={styles.modalPage}><Header title="Select Members" subtitle="Tick every member who should receive this levy" right={<Button title="Done" onPress={() => setShowMembers(false)} />} />{members.isLoading ? <Muted>Loading members…</Muted> : members.data?.map(member => { const checked = selected.includes(member.UserId); return <Pressable key={member.UserId} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setSelected(current => checked ? current.filter(value => value !== member.UserId) : [...current, member.UserId])} style={[styles.member, compact && styles.compactMember, { borderBottomColor: palette.border }]}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={25} color={checked ? palette.primary : palette.muted} /><Avatar name={`${member.FirstName} ${member.LastName}`} uri={member.ProfileImage} size={compact ? 38 : 42} /><View style={styles.flex}><Text style={{ color: palette.text, fontWeight: '900' }}>{member.FirstName} {member.LastName}</Text><Muted numberOfLines={1}>{member.Email}</Muted></View></Pressable>; })}</Screen></Modal>
  </Screen>;
}

function Label({ text, color }: { text: string; color: string }) { return <Text style={[styles.label, { color }]}>{text}</Text>; }
function Selector({ value, onPress, palette }: { value: string; onPress: () => void; palette: any }) { return <Pressable accessibilityRole="button" accessibilityLabel={value} onPress={onPress} style={[styles.selector, { borderColor: palette.border, backgroundColor: palette.surface }]}><Text numberOfLines={2} style={[styles.selectorText, { color: palette.text }]}>{value}</Text><Ionicons name="chevron-down" size={19} color={palette.muted} /></Pressable>; }

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 2, paddingBottom: 120 }, modalPage: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 40 }, form: { width: '100%' }, flex: { flex: 1, minWidth: 0 },
  label: { fontWeight: '900', marginBottom: 7 }, description: { minHeight: 92 }, selector: { width: '100%', minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectorText: { flex: 1, minWidth: 0, fontWeight: '700' },
  member: { width: '100%', minHeight: 70, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 4 }, compactMember: { gap: 8 },
});
