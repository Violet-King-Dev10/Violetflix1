import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ActivityIndicator,
  Modal, PanResponder, GestureResponderEvent, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSizes, FontWeights, Radii } from '@/constants/theme';
import { getMovieDetails } from '@/services/tmdbService';
import { getFallbackStreamUrl, StreamType } from '@/services/streamService';
import { resolveStreamSource } from '@/services/streamResolver';
import { resolveDownloadSource } from '@/services/downloadResolver';
import { triggerSecureDownload } from '@/services/secureDownload';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAlert } from '@/template';
import { WatchPartyBanner } from '@/components/ui/WatchPartyBanner';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function firstParam(v: string | string[] | undefined) { return Array.isArray(v) ? v[0] : v; }
function safeDecodeParam(v: string | undefined, fallback: string) {
  if (!v) return fallback; try { return decodeURIComponent(v); } catch { return v; }
}
function isDirectVideoUrl(u: string | null | undefined) { return Boolean(u && /\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(u)); }

const AD_BLOCKED_DOMAINS = [
  'doubleclick.net','googlesyndication.com','adnxs.com','popads.net','popcash.net',
  'trafficjunky.net','exoclick.com','juicyads.com','tubecorporate.com','adsrvr.org',
  'pubmatic.com','openx.net','rubiconproject.com','adform.net','smartadserver.com',
  'tidaltv.com','loopme.com','undertone.com','spotxchange.com','bidswitch.net',
];

const SPEED_OPTIONS = [
  { label: '0.25x', value: 0.25 },{ label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },{ label: 'Normal', value: 1 },
  { label: '1.25x', value: 1.25 },{ label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },{ label: '2x', value: 2 },
];

function getProgressKey(id: string, type: string, ep?: string, season?: string) {
  return `vflixtv_progress_${type}_${id}${season ? `_s${season}` : ''}${ep ? `_e${ep}` : ''}`;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const id = firstParam(params.id) || '';
  const type = firstParam(params.type) || 'movie';
  const ep = firstParam(params.ep);
  const season = firstParam(params.season);
  const title = firstParam(params.title);
  const trailerKey = firstParam(params.trailerKey);
  const trailer = firstParam(params.trailer);
  const malId = firstParam(params.malId);
  const partyCode = firstParam(params.partyCode);
  const partyHost = firstParam(params.partyHost);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startDownload } = useWatchlist();
  const { showAlert } = useAlert();

  const streamType = type as StreamType;
  const decodedTitle = safeDecodeParam(title, 'VioletFlixTV Player');
  const episodeLabel = ep ? `Episode ${ep}` : null;
  const seasonLabel = season ? `Season ${season}` : null;
  const typeColor = streamType === 'anime' ? '#f59e0b' : streamType === 'tv' ? '#06b6d4' : Colors.primary;
  const progressKey = getProgressKey(id, type, ep, season);

  // Watch Party state
  const [partyActive, setPartyActive] = useState(!!partyCode);
  const [partyMemberCount, setPartyMemberCount] = useState(2);

  // Player state
  const [showControls, setShowControls] = useState(true);
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [trailerVideoKey, setTrailerVideoKey] = useState<string | null>(trailerKey || null);
  const [playingTrailer, setPlayingTrailer] = useState(trailer === '1');
  const [resolvedPrimaryUrl, setResolvedPrimaryUrl] = useState<string | null>(null);
  const [resolvingStream, setResolvingStream] = useState(true);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);

  // Enhanced feature state
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [savedProgress, setSavedProgress] = useState(0);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch gesture state
  const gestureRef = useRef({ startX: 0, startY: 0, startTime: 0, lastTapTime: 0, lastTapX: 0 });
  const seekIndicatorRef = useRef<'forward' | 'backward' | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ dir: 'forward' | 'backward'; secs: number } | null>(null);
  const webviewRef = useRef<WebView>(null);

  const fallbackStreamUrl = useMemo(() => getFallbackStreamUrl({ id, type: streamType, season, episode: ep, malId }), [id, streamType, season, ep, malId]);
  const streamUrl = usingFallback ? fallbackStreamUrl : resolvedPrimaryUrl;
  const trailerUrl = trailerVideoKey ? `https://www.youtube.com/embed/${encodeURIComponent(trailerVideoKey)}?autoplay=1&playsinline=1&rel=0` : null;
  const playbackUrl = playingTrailer && trailerUrl ? trailerUrl : streamUrl;

  // Load saved progress
  useEffect(() => {
    AsyncStorage.getItem(progressKey).then(val => {
      if (val) { const p = parseFloat(val); if (p > 30) { setSavedProgress(p); setShowResumeBanner(true); } }
    }).catch(() => {});
  }, [progressKey]);

  // ── Progress save + episode end detection via injected JS ──
  const progressSaveScript = `
    (function() {
      if (!window._vftvProgressInterval) {
        window._vftvProgressInterval = setInterval(function() {
          var v = document.querySelector('video');
          if (v && !v.paused && v.currentTime > 0) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'progress', currentTime: v.currentTime, duration: v.duration
            }));
          }
        }, 8000);
        var vv = document.querySelector('video');
        if (vv) vv.addEventListener('ended', function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
        });
      }
    })(); true;`;

  // ── Ads guard ──
  const adsGuardScript = streamType !== 'anime' ? `
    (function() {
      var _blocked = ${JSON.stringify(AD_BLOCKED_DOMAINS)};
      var _origOpen = window.open;
      window.open = function(url) {
        if (!url) return null;
        if (_blocked.some(function(d){ return String(url).includes(d); })) return null;
        return null;
      };
      document.addEventListener = (function(orig) {
        return function(type, fn, opts) {
          if (type === 'visibilitychange' || type === 'blur') return;
          return orig.call(document, type, fn, opts);
        };
      })(document.addEventListener);
    })(); true;` : '';

  // ── Speed injection ──
  const speedScript = playbackSpeed !== 1 ? `
    (function() {
      var v = document.querySelector('video');
      if (v) v.playbackRate = ${playbackSpeed};
      new MutationObserver(function() {
        var vv = document.querySelector('video');
        if (vv) vv.playbackRate = ${playbackSpeed};
      }).observe(document.body, { childList: true, subtree: true });
    })(); true;` : '';

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'progress') {
        AsyncStorage.setItem(progressKey, String(msg.currentTime)).catch(() => {});
      } else if (msg.type === 'ended') {
        if ((streamType === 'tv' || streamType === 'anime') && ep) {
          setShowNextEpisode(true); setNextEpCountdown(10);
        }
      }
    } catch {}
  }, [progressKey, streamType, ep]);

  // Next episode countdown
  useEffect(() => {
    if (!showNextEpisode) return;
    countdownRef.current = setInterval(() => {
      setNextEpCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          const nextEp = String((parseInt(ep || '1') || 1) + 1);
          router.replace(`/player/${id}?type=${streamType}&ep=${nextEp}&season=${season || '1'}&title=${encodeURIComponent(decodedTitle)}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [showNextEpisode]);

  // Stream resolver
  useEffect(() => {
    let mounted = true;
    if (playingTrailer) { setResolvingStream(false); return () => { mounted = false; }; }
    setResolvingStream(true); setResolvedPrimaryUrl(null); setStreamLoaded(false); setStreamFailed(false); setUsingFallback(false);
    resolveStreamSource({ id, type: streamType, season, episode: ep, malId, title: decodedTitle })
      .then(source => {
        if (!mounted) return;
        const url = source?.url || null;
        setResolvedPrimaryUrl(url);
        if (!url && fallbackStreamUrl) setUsingFallback(true);
        else if (!url) setStreamFailed(true);
      })
      .catch(() => { if (!mounted) return; if (fallbackStreamUrl) setUsingFallback(true); else setStreamFailed(true); })
      .finally(() => { if (mounted) setResolvingStream(false); });
    return () => { mounted = false; };
  }, [decodedTitle, ep, fallbackStreamUrl, id, malId, playingTrailer, season, streamType]);

  useEffect(() => { setStreamLoaded(false); setStreamFailed(false); }, [playbackUrl]);

  useEffect(() => {
    if (!playbackUrl) { if (!resolvingStream) setStreamFailed(true); return; }
    const t = setTimeout(() => { if (!streamLoaded) setStreamFailed(true); }, 30000);
    return () => clearTimeout(t);
  }, [playbackUrl, resolvingStream, streamLoaded]);

  useEffect(() => {
    if (showControls) { const t = setTimeout(() => setShowControls(false), 4000); return () => clearTimeout(t); }
  }, [showControls]);

  useEffect(() => {
    if (!trailerVideoKey && id && streamType === 'movie') {
      getMovieDetails(Number(id)).then(data => {
        const t = data.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        if (t) setTrailerVideoKey(t.key);
      }).catch(() => {});
    }
  }, [id, streamType, trailerVideoKey]);

  // ── SWIPE GESTURE HANDLER ──────────────────────────────────────────────
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8,

    onPanResponderGrant: (e) => {
      const now = Date.now();
      const { locationX, locationY } = e.nativeEvent;
      gestureRef.current.startX = locationX;
      gestureRef.current.startY = locationY;
      gestureRef.current.startTime = now;

      // Double-tap detection
      const timeSinceLast = now - gestureRef.current.lastTapTime;
      const xDiff = Math.abs(locationX - gestureRef.current.lastTapX);
      if (timeSinceLast < 300 && xDiff < 80) {
        // Double tap — skip ±10s
        const isRight = locationX > SCREEN_W / 2;
        const secs = isRight ? 10 : -10;
        const dir = isRight ? 'forward' : 'backward';
        webviewRef.current?.injectJavaScript(`
          var v = document.querySelector('video');
          if (v) v.currentTime = Math.max(0, v.currentTime + ${secs});
          true;`);
        setSeekIndicator({ dir, secs: Math.abs(secs) });
        setTimeout(() => setSeekIndicator(null), 800);
        gestureRef.current.lastTapTime = 0;
        return;
      }
      gestureRef.current.lastTapTime = now;
      gestureRef.current.lastTapX = locationX;
    },

    onPanResponderRelease: (_, gs) => {
      const { dx, dy } = gs;
      const absDx = Math.abs(dx), absDy = Math.abs(dy);
      const elapsed = Date.now() - gestureRef.current.startTime;
      if (elapsed > 600) return; // too slow = not a swipe

      if (absDx > 40 && absDx > absDy * 1.5) {
        // Horizontal swipe → seek (scaled by distance)
        const seekSecs = Math.round((absDx / SCREEN_W) * 60) * (dx > 0 ? 1 : -1);
        webviewRef.current?.injectJavaScript(`
          var v = document.querySelector('video');
          if (v) v.currentTime = Math.max(0, v.currentTime + ${seekSecs});
          true;`);
        const dir = dx > 0 ? 'forward' : 'backward';
        setSeekIndicator({ dir, secs: Math.abs(seekSecs) });
        setTimeout(() => setSeekIndicator(null), 800);
      } else if (absDy > 40 && absDy > absDx * 1.5) {
        // Vertical swipe → volume
        const volDelta = -dy / SCREEN_H;
        webviewRef.current?.injectJavaScript(`
          var v = document.querySelector('video');
          if (v) v.volume = Math.min(1, Math.max(0, v.volume + ${volDelta.toFixed(2)}));
          true;`);
      } else if (absDx < 12 && absDy < 12) {
        // Tap → toggle controls
        setShowControls(c => !c);
      }
    },
  });

  const handleRetry = () => {
    if (playingTrailer) { setStreamLoaded(false); setStreamFailed(false); return; }
    if (!usingFallback && fallbackStreamUrl) setUsingFallback(true);
    else { setStreamLoaded(false); setStreamFailed(false); }
  };

  const handleOpenExternal = async () => {
    if (!playbackUrl) return;
    try { await WebBrowser.openBrowserAsync(playbackUrl); } catch {}
  };

  const handleDownloadCurrent = async () => {
    if (downloadingCurrent) return;
    setDownloadingCurrent(true);
    try {
      let sourceUrl: string | null = null;
      try { const s = await resolveDownloadSource({ id, type: streamType, title: decodedTitle, season, episode: ep, malId }); sourceUrl = s?.url || null; } catch {}
      await startDownload({
        id: `${streamType}-dl-${id}${season ? `-s${season}` : ''}${ep ? `-e${ep}` : ''}`,
        mediaId: Number(id) || 0, mediaType: streamType, title: decodedTitle,
        posterUrl: '', rating: 0,
        season: season ? Number(season) : undefined, episode: ep ? Number(ep) : undefined,
        episodeName: episodeLabel || undefined,
        size: sourceUrl ? 'Direct link' : 'Unavailable',
        status: sourceUrl ? 'completed' : 'failed', progress: sourceUrl ? 100 : 0,
        sourceUrl: sourceUrl || undefined,
      });
      if (sourceUrl) await triggerSecureDownload({ url: sourceUrl, fileName: `${decodedTitle}${episodeLabel ? ` ${episodeLabel}` : ''}.mp4` });
      showAlert(sourceUrl ? 'Download Started' : 'Download Unavailable', sourceUrl ? `Started download for ${decodedTitle}.` : 'No download source available.');
    } catch { showAlert('Download Error', 'Unable to start the download.'); }
    finally { setDownloadingCurrent(false); }
  };

  const injectedScript = [adsGuardScript, progressSaveScript, speedScript].filter(Boolean).join('\n');

  const renderWebPlayer = () => {
    if (!playbackUrl) return null;
    if (Platform.OS === 'web') {
      if (isDirectVideoUrl(playbackUrl)) {
        return React.createElement('video' as any, {
          src: playbackUrl, style: styles.webFrame, controls: true, autoPlay: true, playsInline: true,
          onCanPlay: () => setStreamLoaded(true), onError: () => { if (!usingFallback && fallbackStreamUrl) setUsingFallback(true); else setStreamFailed(true); },
        });
      }
      return React.createElement('iframe' as any, {
        src: playbackUrl, style: styles.webFrame, allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
        allowFullScreen: true, frameBorder: '0', onLoad: () => setStreamLoaded(true),
        sandbox: streamType !== 'anime' ? 'allow-scripts allow-same-origin allow-forms allow-presentation' : undefined,
      });
    }
    return (
      <WebView
        ref={webviewRef}
        key={playbackUrl}
        source={{ uri: playbackUrl }}
        style={styles.video}
        allowsFullscreenVideo allowsInlineMediaPlayback
        javaScriptEnabled domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always" originWhitelist={['*']}
        setSupportMultipleWindows={false}
        injectedJavaScript={injectedScript || undefined}
        onMessage={handleWebViewMessage}
        onShouldStartLoadWithRequest={(req) => {
          if (streamType !== 'anime') {
            if (AD_BLOCKED_DOMAINS.some(d => req.url.includes(d))) return false;
            try {
              if (req.navigationType === 'other' && req.url !== playbackUrl && new URL(req.url).hostname !== new URL(playbackUrl!).hostname) return false;
            } catch {}
          }
          return true;
        }}
        onLoadEnd={() => setStreamLoaded(true)}
        onError={() => setStreamFailed(true)}
        onHttpError={() => setStreamFailed(true)}
        startInLoadingState
        renderLoading={() => <PlayerLoading />}
      />
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={Platform.OS !== 'web'} />

      {/* Watch Party Live Banner */}
      {partyActive && partyCode ? (
        <WatchPartyBanner
          partyCode={partyCode}
          isHost={partyHost === 'true'}
          memberCount={partyMemberCount}
          onLeave={() => setPartyActive(false)}
        />
      ) : null}

      {/* Player area with gesture handler */}
      <View
        style={[styles.playerArea, partyActive && { marginTop: 34 }]}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      >
        {renderWebPlayer()}

        {resolvingStream || (!streamLoaded && !streamFailed && playbackUrl) ? <PlayerLoading /> : null}

        {/* Seek indicator overlay */}
        {seekIndicator ? (
          <View style={[styles.seekIndicator, seekIndicator.dir === 'forward' ? styles.seekRight : styles.seekLeft]}>
            <Text style={styles.seekIcon}>{seekIndicator.dir === 'forward' ? '⏩' : '⏪'}</Text>
            <Text style={styles.seekText}>{seekIndicator.secs}s</Text>
          </View>
        ) : null}

        {/* Smart Resume Banner */}
        {showResumeBanner && !playingTrailer ? (
          <View style={styles.resumeBanner}>
            <MaterialIcons name="history" size={18} color={Colors.primary} />
            <Text style={styles.resumeText}>Resume watching?</Text>
            <Pressable style={styles.resumeBtn} onPress={() => setShowResumeBanner(false)}>
              <Text style={styles.resumeBtnText}>Resume</Text>
            </Pressable>
            <Pressable onPress={() => { setSavedProgress(0); setShowResumeBanner(false); AsyncStorage.removeItem(progressKey).catch(() => {}); }}>
              <Text style={styles.startOverText}>Start Over</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Next Episode Banner */}
        {showNextEpisode ? (
          <View style={styles.nextEpisodeBanner}>
            <Text style={styles.nextEpTitle}>Next Episode in {nextEpCountdown}s</Text>
            <View style={styles.nextEpActions}>
              <Pressable style={[styles.nextEpBtn, { backgroundColor: typeColor }]} onPress={() => {
                clearInterval(countdownRef.current!);
                const nextEp = String((parseInt(ep || '1') || 1) + 1);
                router.replace(`/player/${id}?type=${streamType}&ep=${nextEp}&season=${season || '1'}&title=${encodeURIComponent(decodedTitle)}`);
              }}>
                <MaterialIcons name="skip-next" size={16} color="#fff" />
                <Text style={styles.nextEpBtnText}>Play Now</Text>
              </Pressable>
              <Pressable style={styles.nextEpCancelBtn} onPress={() => { clearInterval(countdownRef.current!); setShowNextEpisode(false); }}>
                <Text style={styles.nextEpCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Stream failed */}
        {streamFailed ? (
          <View style={styles.messageOverlay}>
            <MaterialIcons name="wifi-off" size={44} color={typeColor} />
            <Text style={styles.messageTitle}>Stream needs another source</Text>
            <Text style={styles.messageText}>The current provider didn't start. Try backup or open externally.</Text>
            <View style={styles.messageActions}>
              {fallbackStreamUrl || usingFallback ? (
                <Pressable style={[styles.messageBtn, { backgroundColor: typeColor }]} onPress={handleRetry}>
                  <Text style={styles.messageBtnText}>{usingFallback ? 'Retry' : 'Use backup'}</Text>
                </Pressable>
              ) : null}
              {playbackUrl && !playingTrailer ? (
                <Pressable style={styles.messageSecondaryBtn} onPress={handleOpenExternal}>
                  <Text style={styles.messageSecondaryText}>Open externally</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Controls overlay */}
        {showControls ? (
          <View style={styles.controlsOverlay} pointerEvents="box-none">
            <View style={[styles.topControls, { paddingTop: insets.top || 16 }]}>
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
              </Pressable>
              <View style={styles.titleArea}>
                <Text style={styles.ctrlTitle} numberOfLines={1}>{decodedTitle}</Text>
                <Text style={styles.ctrlSub} numberOfLines={1}>
                  {[seasonLabel, episodeLabel, playingTrailer ? 'Trailer' : usingFallback ? 'Backup' : 'Primary'].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {trailerVideoKey ? (
                <Pressable onPress={playingTrailer ? () => setPlayingTrailer(false) : () => setPlayingTrailer(true)} style={styles.trailerBtn}>
                  <MaterialIcons name={playingTrailer ? 'movie' : 'play-circle-outline'} size={16} color="#fbbf24" />
                  <Text style={styles.trailerBtnText}>{playingTrailer ? 'Movie' : 'Trailer'}</Text>
                </Pressable>
              ) : null}
              {!playingTrailer ? (
                <Pressable onPress={handleDownloadCurrent} style={[styles.iconBtn, styles.downloadBtn]} disabled={downloadingCurrent}>
                  <MaterialIcons name={downloadingCurrent ? 'sync' : 'download'} size={18} color="#4ade80" />
                </Pressable>
              ) : null}
              <Pressable onPress={handleOpenExternal} style={styles.iconBtn}>
                <MaterialIcons name="open-in-new" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              <Pressable style={styles.speedBtn} onPress={() => setShowSpeedMenu(true)}>
                <MaterialIcons name="speed" size={15} color={Colors.textPrimary} />
                <Text style={styles.speedBtnText}>{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</Text>
              </Pressable>
              <View style={styles.streamBadge}>
                <MaterialIcons name={streamLoaded ? 'wifi' : 'sync'} size={12} color={typeColor} />
                <Text style={[styles.streamBadgeText, { color: typeColor }]}>{streamLoaded ? 'READY' : 'LOADING'}</Text>
              </View>
              <View style={styles.gestureTip}>
                <Text style={styles.gestureTipText}>← swipe to seek · ↕ volume · double-tap ±10s</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Speed Menu */}
      <Modal visible={showSpeedMenu} transparent animationType="fade" onRequestClose={() => setShowSpeedMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSpeedMenu(false)}>
          <View style={styles.speedMenu}>
            <Text style={styles.speedMenuTitle}>Playback Speed</Text>
            {SPEED_OPTIONS.map(opt => (
              <Pressable key={opt.value} style={[styles.speedOption, playbackSpeed === opt.value && styles.speedOptionActive]}
                onPress={() => { setPlaybackSpeed(opt.value); setShowSpeedMenu(false); }}>
                <Text style={[styles.speedOptionText, playbackSpeed === opt.value && styles.speedOptionTextActive]}>{opt.label}</Text>
                {playbackSpeed === opt.value && <MaterialIcons name="check" size={16} color={Colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function PlayerLoading() {
  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading stream...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  playerArea: { flex: 1 },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  webFrame: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderWidth: 0, backgroundColor: '#000' } as any,
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.82)' },
  loadingText: { color: '#aaa', fontSize: FontSizes.sm },
  messageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.88)', paddingHorizontal: 28 },
  messageTitle: { color: '#fff', fontSize: FontSizes.lg, fontWeight: FontWeights.bold, textAlign: 'center' },
  messageText: { color: '#aaa', fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 20 },
  messageActions: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  messageBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.md },
  messageBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  messageSecondaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  messageSecondaryText: { color: '#fff', fontSize: FontSizes.sm },
  controlsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'space-between' },
  topControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  backBtn: { padding: 4 },
  titleArea: { flex: 1 },
  ctrlTitle: { color: '#fff', fontSize: FontSizes.base, fontWeight: FontWeights.semibold },
  ctrlSub: { color: '#aaa', fontSize: FontSizes.xs, marginTop: 1 },
  trailerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  trailerBtnText: { color: '#fbbf24', fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  downloadBtn: { backgroundColor: 'rgba(74,222,128,0.16)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.42)' },
  bottomControls: { paddingHorizontal: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  speedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.full },
  speedBtnText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  streamBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.full },
  streamBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, letterSpacing: 0.8 },
  gestureTip: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: Radii.full },
  gestureTipText: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
  seekIndicator: { position: 'absolute', top: '40%', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, alignItems: 'center', gap: 4 },
  seekLeft: { left: 20 },
  seekRight: { right: 20 },
  seekIcon: { fontSize: 24 },
  seekText: { color: '#fff', fontSize: FontSizes.base, fontWeight: FontWeights.bold },
  resumeBanner: { position: 'absolute', top: 70, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: Radii.md, padding: 12, borderWidth: 1, borderColor: Colors.primary },
  resumeText: { color: '#fff', fontSize: FontSizes.sm, flex: 1 },
  resumeBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.sm },
  resumeBtnText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  startOverText: { color: '#888', fontSize: FontSizes.xs, paddingHorizontal: 6 },
  nextEpisodeBanner: { position: 'absolute', bottom: 50, right: 14, backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: Radii.md, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', minWidth: 180 },
  nextEpTitle: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold, marginBottom: 10 },
  nextEpActions: { flexDirection: 'row', gap: 8 },
  nextEpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.sm },
  nextEpBtnText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  nextEpCancelBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  nextEpCancelText: { color: '#888', fontSize: FontSizes.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  speedMenu: { backgroundColor: '#1a1a2e', borderRadius: Radii.lg, paddingVertical: 8, minWidth: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  speedMenuTitle: { color: '#888', fontSize: FontSizes.xs, fontWeight: FontWeights.bold, paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 1 },
  speedOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  speedOptionActive: { backgroundColor: 'rgba(124,58,237,0.15)' },
  speedOptionText: { color: '#fff', fontSize: FontSizes.base },
  speedOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.bold },
});
