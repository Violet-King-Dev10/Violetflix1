import AsyncStorage from '@react-native-async-storage/async-storage';

const RECO_KEY = 'vftv_reco_events';

interface WatchEvent {
  mediaId: string;
  genre?: string;
  type: string;
  rating?: number;
  watchedAt: number;
}

const get = async (): Promise<WatchEvent[]> => {
  try { const v = await AsyncStorage.getItem(RECO_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
};
const set = async (data: WatchEvent[]) => {
  try { await AsyncStorage.setItem(RECO_KEY, JSON.stringify(data)); } catch {}
};

export const RecoEngine = {
  track: async (mediaId: string, genre: string | undefined, type: string, rating?: number) => {
    const events = await get();
    const ev: WatchEvent = { mediaId, genre: genre?.split(',')[0]?.trim(), type, rating, watchedAt: Date.now() };
    const updated = [ev, ...events.filter(e => e.mediaId !== mediaId)].slice(0, 200);
    await set(updated);
  },

  getTopGenres: async (): Promise<string[]> => {
    const events = await get();
    const counts: Record<string, number> = {};
    for (const ev of events) {
      if (!ev.genre) continue;
      const ageHours = (Date.now() - ev.watchedAt) / 3_600_000;
      const decay = Math.exp(-ageHours / 72);
      const ratingW = ev.rating ? ev.rating / 5 : 0.6;
      counts[ev.genre] = (counts[ev.genre] || 0) + decay * ratingW;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  },

  getWatchedIds: async (): Promise<Set<string>> => {
    const events = await get();
    return new Set(events.map(e => e.mediaId));
  },

  score: async (mediaId: string, genre: string | undefined, voteAverage: number): Promise<number> => {
    const topGenres = await RecoEngine.getTopGenres();
    const watchedIds = await RecoEngine.getWatchedIds();
    if (watchedIds.has(mediaId)) return -1;
    const genres = genre?.split(',').map(g => g.trim()) || [];
    let score = 0;
    for (const g of genres) {
      const rank = topGenres.indexOf(g);
      if (rank !== -1) score += Math.max(0, 10 - rank);
    }
    score += (voteAverage || 0) * 0.5;
    return score;
  },

  hasData: async (): Promise<boolean> => {
    const events = await get();
    return events.length >= 3;
  },
};
