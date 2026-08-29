import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Avatar, Badge, Button, Card, EmptyState, Header, Input, Muted, Screen, useAppTheme } from '@/components/UI';
import { CountryPhoneField } from '@/components/CountryPhoneField';

const categories = ['Electricians', 'Plumbers', 'Cleaners', 'Mechanics', 'Tutors', 'Childcare', 'Restaurants', 'Healthcare', 'Legal services', 'Technology', 'Transport', 'Security', 'Catering', 'Beauty & wellness', 'Home repairs', 'Other'];

export default function Services() {
  const { id, addService } = useLocalSearchParams<{ id: string; addService?: string }>();
  const { palette } = useAppTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [categoryPicker, setCategoryPicker] = useState<'filter' | 'form' | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Technology');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => { if (addService === '1') { setOpen(true); router.setParams({ addService: undefined }); } }, [addService]);

  const capabilities = useQuery<any>({ queryKey: ['capabilities', id], queryFn: async () => (await api.get(`/communities/${id}/capabilities`)).data });
  const canManage = capabilities.data?.permissions?.includes('DIRECTORY_MANAGE');
  const { data = [] } = useQuery<any[]>({ queryKey: ['services', id, filter], queryFn: async () => (await api.get(`/communities/${id}/services`, { params: { category: filter === 'All' ? '' : filter } })).data });
  const review = useMutation({ mutationFn: (v: { providerId: string; rating: number }) => api.post(`/services/${v.providerId}/reviews`, { rating: v.rating, comment: 'Recommended by a community member' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['services', id] }); Alert.alert('Review saved', 'Thanks for helping your community evaluate local providers.'); } });
  const verify = useMutation({ mutationFn: (v: { providerId: string; isVerified: boolean }) => api.patch(`/communities/${id}/services/${v.providerId}/verification`, { isVerified: v.isVerified }), onSuccess: () => qc.invalidateQueries({ queryKey: ['services', id] }) });
  const create = useMutation({ mutationFn: () => api.post(`/communities/${id}/services`, { name, category, phone, description }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['services', id] }); setOpen(false); Alert.alert('Service added', 'The listing is now available in this community directory.'); } });

  return <Screen scroll>
    <Header page title="Local Services" subtitle="A community-focused directory of local providers. Verification is separate from member recommendations." />
    <View style={styles.categories}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === 'All' }} onPress={() => setFilter('All')} style={[styles.chip, { borderColor: filter === 'All' ? palette.primary : palette.border, backgroundColor: filter === 'All' ? palette.primary : palette.surface }]}><Ionicons name="grid-outline" size={17} color={filter === 'All' ? '#fff' : palette.primary} /><Text style={[styles.chipText, { color: filter === 'All' ? '#fff' : palette.text }]}>All</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose service category" onPress={() => setCategoryPicker('filter')} style={[styles.categoryButton, { borderColor: filter !== 'All' ? palette.primary : palette.border, backgroundColor: palette.surface }]}><Ionicons name="options-outline" size={18} color={palette.primary} /><Text numberOfLines={1} style={[styles.categoryText, { color: filter !== 'All' ? palette.primary : palette.text }]}>{filter === 'All' ? 'Category' : filter}</Text><Ionicons name="chevron-down" size={17} color={palette.muted} /></Pressable>
    </View>
    {data.length ? data.map(provider => <Card key={provider.Id} style={styles.card}><Avatar name={provider.Name} /><View style={styles.provider}>
      <View style={styles.nameRow}><Text style={[styles.name, { color: palette.text }]}>{provider.Name}</Text>{provider.IsVerified ? <Badge text="✓ Verified" tone="green" /> : null}</View>
      <Muted>{provider.Category}{provider.Area ? ` · ${provider.Area}` : ''}</Muted><Muted>★ {Number(provider.Rating || 0).toFixed(1)} · {provider.ReviewCount || 0} reviews</Muted>
      {provider.Description ? <Text style={[styles.description, { color: palette.text }]}>{provider.Description}</Text> : null}
      {provider.Phone ? <Button title="Call Provider" variant="secondary" onPress={() => Linking.openURL(`tel:${provider.Phone}`)} /> : null}
      <Button title="Recommend · 5★" variant="ghost" onPress={() => review.mutate({ providerId: provider.Id, rating: 5 })} />
      {canManage ? <Button title={provider.IsVerified ? 'Remove Verification' : 'Verify Provider'} variant={provider.IsVerified ? 'secondary' : 'success'} onPress={() => verify.mutate({ providerId: provider.Id, isVerified: !provider.IsVerified })} /> : null}
    </View></Card>) : <EmptyState icon="storefront-outline" title="No providers yet" body="Add trusted local services such as electricians, tutors, childcare, healthcare or transport." />}
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {setOpen(false);setCategoryPicker(null)}}><Screen scroll>
      <Header title="Add Service" right={<Pressable accessibilityLabel="Close add service" onPress={() => {setOpen(false);setCategoryPicker(null)}}><Ionicons name="close" size={26} color={palette.text} /></Pressable>} />
      <Input placeholder="Business or provider name" value={name} onChangeText={setName} />
      <Text style={[styles.fieldLabel, { color: palette.text }]}>Category</Text><Pressable accessibilityRole="button" accessibilityLabel="Select service category" accessibilityState={{expanded:categoryPicker==='form'}} onPress={() => setCategoryPicker(current => current === 'form' ? null : 'form')} style={[styles.formCategory, { borderColor: categoryPicker==='form'?palette.primary:palette.border, backgroundColor: palette.surface }]}><Text numberOfLines={1} style={[styles.formCategoryText, { color: palette.text }]}>{category}</Text><Ionicons name={categoryPicker==='form'?'chevron-up':'chevron-down'} size={20} color={palette.primary} /></Pressable>
      {categoryPicker==='form'?<View style={[styles.formPicker,{borderColor:palette.border,backgroundColor:palette.surface}]}><View style={styles.pickerGrid}>{categories.map(item=>{const selected=category===item;return <Pressable key={item} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>{setCategory(item);setCategoryPicker(null)}} style={[styles.pickerOption,{borderColor:selected?palette.primary:palette.border,backgroundColor:selected?palette.primarySoft:palette.background}]}><Text style={[styles.optionText,{color:selected?palette.primary:palette.text}]}>{item}</Text>{selected?<Ionicons name="checkmark-circle" size={18} color={palette.primary}/>:null}</Pressable>})}</View></View>:null}
      <CountryPhoneField value={phone} onChange={setPhone} /><Input placeholder="Description" multiline value={description} onChangeText={setDescription} />
      <Button title="Add to Directory" loading={create.isPending} onPress={() => create.mutate()} disabled={name.length < 2 || category.length < 2} />
    </Screen></Modal>
    <Modal visible={categoryPicker === 'filter'} transparent animationType="fade" onRequestClose={() => setCategoryPicker(null)}><Pressable style={styles.backdrop} onPress={() => setCategoryPicker(null)}><Pressable accessibilityRole="menu" style={[styles.picker, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => {}}><View style={styles.pickerHeader}><View><Text style={[styles.pickerTitle, { color: palette.text }]}>Service category</Text><Muted>Choose one category</Muted></View><Pressable accessibilityLabel="Close categories" onPress={() => setCategoryPicker(null)} style={styles.close}><Ionicons name="close" size={24} color={palette.text} /></Pressable></View><View style={styles.pickerGrid}>{categories.map(item => { const selected = filter === item; return <Pressable key={item} accessibilityRole="menuitem" onPress={() => { setFilter(item); setCategoryPicker(null); }} style={[styles.pickerOption, { borderColor: selected ? palette.primary : palette.border, backgroundColor: selected ? palette.primarySoft : palette.background }]}><Text style={[styles.optionText, { color: selected ? palette.primary : palette.text }]}>{item}</Text>{selected ? <Ionicons name="checkmark-circle" size={18} color={palette.primary} /> : null}</Pressable>; })}</View></Pressable></Pressable></Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 14 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.25, borderRadius: 22, paddingHorizontal: 15 },
  chipText: { fontSize: 13, fontWeight: '900' },
  categoryButton: { flex: 1, minWidth: 0, maxWidth: 250, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.25, borderRadius: 22, paddingHorizontal: 14 },
  categoryText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '900' },
  card: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, provider: { flex: 1, minWidth: 190 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, name: { fontSize: 16, fontWeight: '900', flex: 1, minWidth: 120 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '900', marginBottom: 7 },
  formCategory: { minHeight: 54, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  formCategoryText: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600' },
  formPicker: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 10, marginTop: -5, marginBottom: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,31,68,.38)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  picker: { width: '100%', maxWidth: 430, maxHeight: '86%', borderWidth: 1, borderRadius: 22, padding: 16, shadowColor: '#0F1F44', shadowOpacity: .2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  pickerTitle: { fontSize: 19, fontWeight: '900' }, close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { width: '48%', minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  optionText: { flex: 1, fontSize: 12, fontWeight: '800' },
});
