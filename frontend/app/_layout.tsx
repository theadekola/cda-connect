import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';
import { useAccessibility } from '@/store/accessibility';

const qc=new QueryClient();
export default function Root(){
  const {hydrated,load}=useAuth();
  const a=useAccessibility();
  useEffect(()=>{load();a.load()},[]);
  if(!hydrated||!a.hydrated)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}}><ActivityIndicator color={colors.primary}/></View>;
  return <QueryClientProvider client={qc}><Stack screenOptions={{headerShown:false}}><Stack.Screen name="index"/><Stack.Screen name="(auth)"/><Stack.Screen name="(tabs)"/><Stack.Screen name="community/[id]"/><Stack.Screen name="chat/[id]"/></Stack></QueryClientProvider>;
}
