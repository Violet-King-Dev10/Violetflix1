import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Radii } from '@/constants/theme';

interface Props {
  partyCode: string;
  isHost: boolean;
  memberCount: number;
  onLeave: () => void;
}

export function WatchPartyBanner({ partyCode, isHost, memberCount, onLeave }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      <View style={styles.center}>
        <MaterialIcons name="group" size={13} color="#a78bfa" />
        <Text style={styles.memberText}>{memberCount} watching</Text>
        <View style={styles.divider} />
        <Text style={styles.roleText}>{isHost ? '👑 Host' : '🎬 Guest'}</Text>
        <View style={styles.divider} />
        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>CODE </Text>
          <Text style={styles.codeValue}>{partyCode}</Text>
        </View>
      </View>

      <Pressable onPress={onLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveBtnText}>Leave</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,5,30,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.4)',
    paddingHorizontal: 12, paddingVertical: 7, zIndex: 100, gap: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  liveText: { color: '#4ade80', fontSize: 9, fontWeight: FontWeights.black, letterSpacing: 1.5 },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  memberText: { color: '#c4b5fd', fontSize: 10, fontWeight: FontWeights.semibold },
  divider: { width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  roleText: { color: '#e2d9fa', fontSize: 10 },
  codeWrap: { flexDirection: 'row', alignItems: 'center' },
  codeLabel: { color: '#888', fontSize: 9, letterSpacing: 1 },
  codeValue: { color: '#a78bfa', fontSize: 10, fontWeight: FontWeights.black, letterSpacing: 2 },
  leaveBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.full,
  },
  leaveBtnText: { color: '#f87171', fontSize: 9, fontWeight: FontWeights.bold },
});
