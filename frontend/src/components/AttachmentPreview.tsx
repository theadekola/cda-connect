import React from 'react';
import { Alert, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Muted, useAppTheme } from './UI';

export type Attachment = { url: string; title?: string; mimeType?: string } | null;

function extension(url: string) { try { return new URL(url).pathname.split('.').pop()?.toLowerCase() || ''; } catch { return url.split('?')[0].split('.').pop()?.toLowerCase() || ''; } }
function isImage(file: NonNullable<Attachment>) { return file.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension(file.url)); }
function isVideo(file: NonNullable<Attachment>) { return file.mimeType?.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(extension(file.url)); }

export function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const { palette } = useAppTheme();
  const { width, height } = useWindowDimensions();
  if (!attachment) return null;
  const maxWidth = Math.min(Math.max(280, width - 28), 860);
  const maxHeight = Math.min(Math.max(420, height - 50), 760);
  const title = attachment.title || decodeURIComponent(attachment.url.split('/').pop()?.split('?')[0] || 'Attachment');
  async function save() {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') { const link = document.createElement('a'); link.href = attachment!.url; link.download = title; link.target = '_blank'; link.rel = 'noopener'; document.body.appendChild(link); link.click(); link.remove(); return; }
      await Linking.openURL(attachment!.url);
    } catch { Alert.alert('Unable to save file', 'The attachment could not be downloaded. Please try again.'); }
  }
  const preview = isImage(attachment)
    ? <Image source={{ uri: attachment.url }} resizeMode="contain" style={styles.preview} accessibilityLabel={title} />
    : Platform.OS === 'web'
      ? React.createElement('iframe', { src: attachment.url, title, style: { width: '100%', height: '100%', border: '0', backgroundColor: '#fff' }, allow: isVideo(attachment) ? 'autoplay; fullscreen' : undefined })
      : <View style={styles.fallback}><Ionicons name={isVideo(attachment) ? 'videocam-outline' : 'document-text-outline'} size={64} color={palette.primary} /><Text numberOfLines={3} style={[styles.fallbackTitle, { color: palette.text }]}>{title}</Text><Muted style={styles.center}>Use Save to download or open this file with a compatible app on your device.</Muted></View>;
  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><View style={styles.backdrop}><View accessibilityViewIsModal style={[styles.dialog, { width: maxWidth, height: maxHeight, backgroundColor: palette.surface, borderColor: palette.border }]}><View style={[styles.header, { borderBottomColor: palette.border }]}><Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>{title}</Text></View><View style={[styles.viewer, { backgroundColor: palette.backgroundSoft }]}>{preview}</View><View style={[styles.actions, { borderTopColor: palette.border }]}><View style={styles.action}><Button title="Close" variant="secondary" icon="close" onPress={onClose} /></View><View style={styles.action}><Button title="Save" variant="success" icon="download-outline" onPress={save} /></View></View></View></View></Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: 'rgba(5,14,32,.72)' }, dialog: { maxWidth: '100%', maxHeight: '94%', minHeight: 360, borderWidth: 1, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: .3, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 30 }, header: { minHeight: 54, justifyContent: 'center', borderBottomWidth: 1, paddingHorizontal: 16 }, title: { fontSize: 17, fontWeight: '900' }, viewer: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }, preview: { width: '100%', height: '100%' }, fallback: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, fallbackTitle: { maxWidth: '100%', fontSize: 18, fontWeight: '900', textAlign: 'center' }, center: { textAlign: 'center' }, actions: { width: '100%', minHeight: 70, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 8 }, action: { flex: 1, minWidth: 0 } });
