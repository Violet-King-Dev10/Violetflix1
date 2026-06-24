import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput,
  ActivityIndicator, Clipboard, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Radii, FontSizes, FontWeights } from '@/constants/theme';
import { TMDB_IMAGE } from '@/constants/config';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartParty: (code: string, isHost: boolean) => void;
  movieTitle?: string;
  posterPath?: string;
  mediaId?: string;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function WatchPartyModal({ visible, onClose, onStartParty, movieTitle, posterPath, mediaId }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [createdCode, setCreatedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateParty = async () => {
    setCreating(true);
    const code = generateCode();
    try {
      await fetch(`https://violetflix-fd1e1-default-rtdb.firebaseio.com/watchparty/${code}.json`, {
        method: 'PUT',
        body: JSON.stringify({ currentTime: 0, paused: true, updatedAt: Date.now(), members: 1, mediaId }),
      }).catch(() => {});
    } catch {}
    setCreatedCode(code);
    setCreating(false);
  };

  const copyCode = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(createdCode).catch(() => {});
    } else {
      Clipboard.setString(createdCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startAsHost = () => { onStartParty(createdCode, true); onClose(); reset(); };
  const joinParty = () => {
    if (joinCode.trim().length < 4) return;
    onStartParty(joinCode.trim().toUpperCase(), false);
    onClose();
    reset();
  };
  const reset = () => { setCreatedCode(''); setJoinCode(''); setMode('create'); };

  const posterUri = posterPath ? TMDB_IMAGE(posterPath, 'w185') : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Watch Party 🎉</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={16} color="#999" />
            </Pressable>
          </View>

          {/* Movie preview */}
          <View style={styles.movieRow}>
            {posterUri
              ? <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
              : <View style={[styles.poster, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="movie" size={24} color="#7c3aed" />
                </View>
            }
            <View style={styles.movieInfo}>
              <Text style={styles.movieTitle} numberOfLines={2}>{movieTitle || 'Now Playing'}</Text>
              <Text style={styles.movieSub}>Synchronized real-time playback</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['create', 'join'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tab, mode === tab && styles.tabActive]}
                onPress={() => { setMode(tab); setCreatedCode(''); }}
              >
                <Text style={[styles.tabText, mode === tab && styles.tabTextActive]}>
                  {tab === 'create' ? 'Create' : 'Join'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'create' ? (
            <View style={styles.body}>
              {!createdCode ? (
                <Pressable style={styles.primaryBtn} onPress={handleCreateParty} disabled={creating}>
                  {creating
                    ? <ActivityIndicator size={16} color="#fff" />
                    : <MaterialIcons name="group" size={18} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Create Party Room</Text>
                </Pressable>
              ) : (
                <>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>Share this code with friends</Text>
                    <Text style={styles.codeText}>{createdCode}</Text>
                  </View>
                  <Pressable style={[styles.secondaryBtn, copied && styles.copiedBtn]} onPress={copyCode}>
                    <MaterialIcons name={copied ? 'check' : 'content-copy'} size={16} color={copied ? '#4ade80' : '#fff'} />
                    <Text style={[styles.secondaryBtnText, copied && { color: '#4ade80' }]}>
                      {copied ? 'Copied!' : 'Copy Code'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtn} onPress={startAsHost}>
                    <MaterialIcons name="play-arrow" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Start as Host</Text>
                  </Pressable>
                  <Text style={styles.hint}>You control playback · others will auto-sync</Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.body}>
              <TextInput
                style={styles.codeInput}
                value={joinCode}
                onChangeText={t => setJoinCode(t.toUpperCase())}
                placeholder="Enter party code (e.g. ABC123)"
                placeholderTextColor="#555"
                maxLength={6}
                autoCapitalize="characters"
              />
              <Pressable
                style={[styles.primaryBtn, joinCode.trim().length < 4 && { opacity: 0.5 }]}
                onPress={joinParty}
                disabled={joinCode.trim().length < 4}
              >
                <MaterialIcons name="login" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Join Party</Text>
              </Pressable>
              <Text style={styles.hint}>Playback will sync to the host automatically</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#0f0f1a',
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: FontSizes.lg, fontWeight: FontWeights.black },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  movieRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  poster: { width: 48, height: 64, borderRadius: 8 },
  movieInfo: { flex: 1 },
  movieTitle: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  movieSub: { color: '#666', fontSize: 11, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  tabActive: { backgroundColor: '#7c3aed' },
  tabText: { color: '#888', fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  tabTextActive: { color: '#fff' },
  body: { gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  copiedBtn: { borderColor: 'rgba(74,222,128,0.4)', backgroundColor: 'rgba(74,222,128,0.1)' },
  secondaryBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  codeBox: { backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 14, padding: 16, alignItems: 'center' },
  codeLabel: { color: '#888', fontSize: 11, marginBottom: 6 },
  codeText: { color: '#a78bfa', fontSize: 32, fontWeight: FontWeights.black, letterSpacing: 8 },
  codeInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: FontSizes.base, textAlign: 'center', letterSpacing: 4, fontFamily: 'monospace' },
  hint: { color: '#555', fontSize: 11, textAlign: 'center' },
});
