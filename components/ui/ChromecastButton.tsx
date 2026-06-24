import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Pressable, Text, StyleSheet, Platform, Alert } from 'react-native';
import { Colors, FontSizes, FontWeights, Radii } from '@/constants/theme';

interface CastState { available: boolean; connected: boolean; deviceName: string; casting: boolean; }

function useCastToTV() {
  const [castState, setCastState] = useState<CastState>({ available: false, connected: false, deviceName: '', casting: false });
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable) return;
      try {
        const ctx = (window as any).cast.framework.CastContext.getInstance();
        ctx.setOptions({
          receiverApplicationId: (window as any).chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        ctx.addEventListener((window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED, () => {
          const s = ctx.getCurrentSession();
          if (s) {
            setCastState({ available: true, connected: true, deviceName: s.getCastDevice().friendlyName, casting: false });
            sessionRef.current = s;
          } else {
            setCastState(p => ({ ...p, connected: false, deviceName: '', casting: false }));
            sessionRef.current = null;
          }
        });
        setCastState(p => ({ ...p, available: true }));
      } catch {}
    };
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  const requestCast = useCallback(async (videoUrl: string, title: string, posterUrl?: string) => {
    if (Platform.OS !== 'web') {
      Alert.alert('Chromecast', 'Casting to TV is available on the web version of VioletFlixTV. Open the app in Chrome on a device connected to the same Wi-Fi as your Chromecast.');
      return;
    }
    try {
      const ctx = (window as any).cast.framework.CastContext.getInstance();
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;
      const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(videoUrl, 'video/mp4');
      mediaInfo.metadata = new (window as any).chrome.cast.media.MovieMediaMetadata();
      mediaInfo.metadata.title = title;
      if (posterUrl) mediaInfo.metadata.images = [new (window as any).chrome.cast.Image(posterUrl)];
      const req = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
      await (session as any).loadMedia(req);
      setCastState(p => ({ ...p, casting: true }));
    } catch (err: any) {
      if (err?.code !== 'CANCEL') console.warn('Cast error', err);
    }
  }, []);

  const stopCast = useCallback(() => {
    if (Platform.OS !== 'web') return;
    try {
      (window as any).cast.framework.CastContext.getInstance().endCurrentSession(true);
      setCastState(p => ({ ...p, casting: false }));
    } catch {}
  }, []);

  return { castState, requestCast, stopCast };
}

interface Props { videoUrl?: string; title: string; posterUrl?: string; }

export function ChromecastButton({ videoUrl, title, posterUrl }: Props) {
  const { castState, requestCast, stopCast } = useCastToTV();

  if (castState.casting) {
    return (
      <Pressable style={[styles.btn, styles.casting]} onPress={stopCast}>
        <Text style={styles.castIcon}>📺</Text>
        <Text style={[styles.btnText, { color: '#60a5fa' }]}>{castState.deviceName || 'Casting…'}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.btn, castState.connected && styles.connected]}
      onPress={() => videoUrl ? requestCast(videoUrl, title, posterUrl) : Alert.alert('Cast to TV', 'Requires a Chromecast on the same Wi-Fi.')}
    >
      <Text style={styles.castIcon}>📺</Text>
      <Text style={styles.btnText}>Cast to TV</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  connected: { borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.1)' },
  casting: { borderColor: 'rgba(96,165,250,0.5)', backgroundColor: 'rgba(96,165,250,0.15)' },
  castIcon: { fontSize: 14 },
  btnText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
});
