import React, { createContext, useContext, useEffect, useEffectEvent, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLibrary } from '../state';
import { resolveUri } from '../uri';
import { Track } from '../model';

type Repeat = 'off' | 'all' | 'one';
type Playback = {
  track?: Track; playing: boolean; loading: boolean; position: number; total: number;
  error: string; repeat: Repeat; shuffle: boolean; setRepeat: () => void; setShuffle: () => void;
  play: (id: string, queue?: string[]) => void; toggle: () => void; pause: () => void;
  playTrack: (track: Track, queue: Track[]) => void;
  releaseSession: () => void;
  seek: (ms: number) => void; next: () => void; previous: () => void;
};
const Context = createContext<Playback>(null!);
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { data, update, ready } = useLibrary();
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off'), [shuffle, setShuffle] = useState(false);
  const track = data.tracks.find(t => t.id === data.current);
  const autoPlay = useRef(false), restore = useRef(true), loaded = useRef<string | undefined>(undefined);
  const snapshot = useRef(data), repeatRef = useRef(repeat), shuffleRef = useRef(shuffle);
  useEffect(() => { snapshot.current = data; repeatRef.current = repeat; shuffleRef.current = shuffle; }, [data, repeat, shuffle]);
  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true,
    interruptionMode: 'doNotMix', shouldRouteThroughEarpiece: false }).catch(() => setError('Audio setup failed. Restart the app to retry.')); }, []);
  useEffect(() => {
    if (!ready) return;
    if (!track) { player.pause(); player.replace(null); loaded.current = undefined; return; }
    let cancelled = false;
    resolveUri(track.uri).then(async uri => {
      if (cancelled) return;
      setLoading(true); setError('');
      player.replace({ uri }); loaded.current = track.id;
      player.setActiveForLockScreen(true, { title: track.title, artist: track.artist, artworkUrl: track.artwork },
        { showSeekForward: true, showSeekBackward: true });
      if (restore.current && snapshot.current.position > 0) await player.seekTo(snapshot.current.position / 1000);
      restore.current = false;
      if (!cancelled && autoPlay.current) player.play();
    }).catch(e => { if (!cancelled) { setError(e.message || 'Unable to play this file. Try importing it again.'); loaded.current = undefined; } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [track, ready, player]);
  useEffect(() => {
    // Expo exposes loop as a mutable native-player property.
    // eslint-disable-next-line react-hooks/immutability
    player.loop = repeat === 'one';
  }, [repeat, player]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (loaded.current && player.isLoaded) update(d => ({ ...d, position: Math.round(player.currentTime * 1000) }));
    }, 5000);
    return () => clearInterval(timer);
  }, [player, update]);
  const activate = () => { const t = snapshot.current.tracks.find(t => t.id === snapshot.current.current); if (t) player.setActiveForLockScreen(true, { title: t.title, artist: t.artist, artworkUrl: t.artwork }, { showSeekForward: true, showSeekBackward: true }); };
  const play = (id: string, queue?: string[]) => {
    if (!snapshot.current.tracks.some(t => t.id === id)) return;
    autoPlay.current = true;
    if (id === snapshot.current.current && loaded.current === id) { if (queue) update(d => ({ ...d, queue })); activate(); player.play(); return; }
    player.pause();
    update(d => ({ ...d, current: id, position: 0, queue: queue ?? (d.queue.includes(id) ? d.queue : [...d.queue, id]),
      history: [id, ...d.history.filter(t => t !== id)].slice(0, 50) }));
  };
  const next = () => {
    const d = snapshot.current, queue = d.queue.filter(id => d.tracks.some(t => t.id === id));
    if (!queue.length) return;
    const index = queue.indexOf(d.current ?? '');
    let target = index + 1;
    if (shuffleRef.current && queue.length > 1) {
      const choices = queue.filter(id => id !== d.current); play(choices[Math.floor(Math.random() * choices.length)]); return;
    }
    if (target >= queue.length) {
      if (repeatRef.current === 'all') target = 0;
      else { player.pause(); return; }
    }
    if (queue[target] === d.current) { void player.seekTo(0).then(() => player.play()).catch(e => setError(e.message)); }
    else play(queue[target]);
  };
  const playTrack = (selected: Track, tracks: Track[]) => {
    autoPlay.current = true;
    if (loaded.current === selected.id) { activate(); player.play(); } else player.pause();
    update(d => {
      const additions = [...tracks, selected].filter((t, index, all) => !d.tracks.some(existing => existing.id === t.id) && all.findIndex(other => other.id === t.id) === index);
      return { ...d, tracks: [...d.tracks, ...additions], current: selected.id,
        position: selected.id === d.current ? d.position : 0, queue: [...new Set(tracks.map(t => t.id).concat(selected.id))],
        history: [selected.id, ...d.history.filter(id => id !== selected.id)].slice(0, 50) };
    });
  };
  const finished = useEffectEvent(() => { if (repeat !== 'one') next(); });
  useEffect(() => { if (status.didJustFinish) finished(); }, [status.didJustFinish]);
  const seek = (ms: number) => { void player.seekTo(Math.max(0, ms) / 1000).catch(e => setError(e.message)); };
  const pause = () => { autoPlay.current = false; player.pause(); };
  const releaseSession = () => { pause(); player.setActiveForLockScreen(false); };
  const toggle = () => { if (!track) return; if (status.playing) pause(); else { autoPlay.current = true; try { activate(); player.play(); } catch (e) { setError(String(e)); } } };
  const previous = () => {
    if (status.currentTime > 3) { seek(0); return; }
    const index = data.queue.indexOf(data.current ?? ''); if (index > 0) play(data.queue[index - 1]); else seek(0);
  };
  return <Context.Provider value={{ track, playing: status.playing, loading: loading || status.isBuffering,
    position: status.currentTime * 1000, total: (status.duration || (track?.duration ?? 0) / 1000) * 1000,
    error: error || status.error || '', repeat, shuffle, setRepeat: () => setRepeat(v => v === 'off' ? 'all' : v === 'all' ? 'one' : 'off'),
    setShuffle: () => setShuffle(v => !v), play, playTrack, toggle, pause, releaseSession, seek, next, previous }}>{children}</Context.Provider>;
}
export const usePlayback = () => useContext(Context);
