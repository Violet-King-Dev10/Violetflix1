import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Linking, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Radii, FontSizes, FontWeights } from '@/constants/theme';
import { TMDB_IMAGE } from '@/constants/config';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  type?: string;
  year?: string;
  posterPath?: string;
  mediaId?: string | number;
}

export function SocialShareModal({ visible, onClose, title, type, year, posterPath, mediaId }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://violetflixtv.vercel.app/movie/${mediaId}`;
  const shareText = `🎬 Watch "${title}" on VioletFlixTV!`;
  const posterUri = posterPath ? TMDB_IMAGE(posterPath, 'w185') : null;

  const share = (platform: string) => {
    const urls: Record<string, string> = {
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    };
    if (platform === 'copy') {
      if (Platform.OS === 'web') {
        navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return;
    }
    Linking.openURL(urls[platform]).catch(() => {});
  };

  const PLATFORMS = [
    { id: 'telegram', label: 'Telegram', color: '#229ED9', bg: 'rgba(34,158,217,0.12)', border: 'rgba(34,158,217,0.3)', icon: '✈️' },
    { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.3)', icon: '💬' },
    { id: 'twitter', label: 'X', color: '#1DA1F2', bg: 'rgba(29,161,242,0.12)', border: 'rgba(29,161,242,0.3)', icon: '🐦' },
    { id: 'facebook', label: 'Facebook', color: '#1877F2', bg: 'rgba(24,119,242,0.12)', border: 'rgba(24,119,242,0.3)', icon: '👤' },
    { id: 'copy', label: copied ? 'Copied!' : 'Copy Link', color: '#fff', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', icon: copied ? '✅' : '🔗' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Share</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={16} color="#999" />
            </Pressable>
          </View>

          <View style={styles.movieRow}>
            {posterUri
              ? <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
              : <View style={[styles.poster, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="movie" size={24} color="#7c3aed" />
                </View>
            }
            <View style={styles.movieInfo}>
              <Text style={styles.movieTitle} numberOfLines={2}>{title}</Text>
              {(type || year) && (
                <Text style={styles.movieMeta}>{[type, year].filter(Boolean).join(' • ')}</Text>
              )}
            </View>
          </View>

          <View style={styles.grid}>
            {PLATFORMS.map(p => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.platformBtn,
                  { backgroundColor: p.bg, borderColor: p.border },
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => share(p.id)}
              >
                <Text style={styles.platformIcon}>{p.icon}</Text>
                <Text style={[styles.platformLabel, { color: p.color }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: '#0f0f1a', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: FontSizes.lg, fontWeight: FontWeights.black },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  movieRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  poster: { width: 48, height: 70, borderRadius: 8 },
  movieInfo: { flex: 1 },
  movieTitle: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  movieMeta: { color: '#666', fontSize: 11, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  platformBtn: { width: '30%', flex: undefined, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 6 },
  platformIcon: { fontSize: 22 },
  platformLabel: { fontSize: 10, fontWeight: FontWeights.bold },
});
