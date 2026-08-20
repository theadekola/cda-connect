import Constants from 'expo-constants';
import { Card, Header, Muted, Screen, SectionTitle } from '@/components/UI';
export default function About(){return <Screen scroll><Header title="About CDA Connect" subtitle="Connect. Collaborate. Create stronger communities."/><Card><Muted>CDA Connect brings communication, governance, safety, services, events and records into one secure community workspace.</Muted></Card><SectionTitle>Version</SectionTitle><Card><Muted>{Constants.expoConfig?.version||'1.0.0'}</Muted></Card></Screen>}
