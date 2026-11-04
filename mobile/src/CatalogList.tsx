import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Art, Button, IconButton, s } from './components';
import { colors as c } from './theme';
import { fetchCatalog } from './catalog';
import { Track, time } from './model';
import { useLibrary } from './state';
import { usePlayback } from './audio/player';

export function Catalog({ query = '', compact = false }: { query?: string; compact?: boolean }) {
  const { data, update } = useLibrary(), player = usePlayback();
  const [tracks, setTracks] = useState<Track[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [offset, setOffset] = useState(0), [more, setMore] = useState(false), [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [externalError, setExternalError] = useState('');
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => {
      setLoading(true); setError(''); setTracks([]); setOffset(0); setMore(false);
      fetchCatalog(query, 0, controller.signal).then(page => {
        if (!controller.signal.aborted) { setTracks(page.tracks); setMore(page.more); }
      }).catch(e => { if (!controller.signal.aborted) setError(e.message || 'Music is unavailable. Check your connection.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, retry]);
  const loadMore = async () => {
    setLoading(true); setError('');
    const controller = request.current!, next = offset + 30;
    try { const page = await fetchCatalog(query, next, controller.signal);
      if (!controller.signal.aborted) { setTracks(previous => [...previous, ...page.tracks.filter(t => !previous.some(p => p.id === t.id))]); setOffset(next); setMore(page.more); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Music could not be loaded.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const save = (track: Track) => update(d => ({ ...d,
    tracks: d.tracks.some(t => t.id === track.id) ? d.tracks : [...d.tracks, track],
    likes: d.likes.includes(track.id) ? d.likes.filter(id => id !== track.id) : [...d.likes, track.id] }));
  const openYouTubeMusic = () => {
    setExternalError('');
    player.releaseSession();
    void Linking.openURL(`https://music.youtube.com/search?q=${encodeURIComponent(query.trim())}`)
      .catch(() => setExternalError('Could not open YouTube Music. Please try again.'));
  };
  return <View style={{ gap: 12 }}>
    <View style={s.between}><Text style={s.h2}>{query ? 'Listen now' : 'Discover something new'}</Text><Text style={s.badge}>FULL TRACKS</Text></View>
    <Text style={s.small}>Free independent music · Streaming from Audius</Text>
    {!!query.trim() && !loading && <View style={s.card}>
      <Text style={s.trackTitle}>{tracks.length ? 'Looking for a different song?' : error ? 'Try another music service' : 'No matching tracks on Audius'}</Text>
      <Text style={s.muted}>Find the song in YouTube Music, then copy its video link into “Play a YouTube link” above to watch inside VibeCut.</Text>
      <Button title="Search YouTube Music" icon="open-outline" secondary onPress={openYouTubeMusic} />
      <Text style={s.small}>Opens YouTube Music · Playback happens there</Text>
      {!!externalError && <Text style={s.error}>{externalError}</Text>}
    </View>}
    {(compact && !expanded ? tracks.slice(0, 6) : tracks).map(track => <View key={track.id} style={s.trackRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Stream ${track.title}`} onPress={() => player.playTrack(track, tracks)} style={s.trackMain}>
        <Art track={track} /><View style={s.flex}><Text numberOfLines={1} style={[s.trackTitle, player.track?.id === track.id && { color: c.blueText }]}>{track.title}</Text><Text numberOfLines={1} style={s.small}>{track.artist} · {time(track.duration)}</Text></View>
      </Pressable><IconButton name={data.likes.includes(track.id) ? 'heart' : 'heart-outline'} label={`Save ${track.title}`} active={data.likes.includes(track.id)} onPress={() => save(track)} />
    </View>)}
    {loading && <ActivityIndicator color={c.blueText} accessibilityLabel="Loading free music" />}
    {!!error && <View style={s.card}><Text style={s.error}>{error}</Text><Button title="Retry music" secondary onPress={() => setRetry(v => v + 1)} /></View>}
    {!query.trim() && !loading && !error && !tracks.length && <Text style={s.muted}>No free tracks found. Try an artist, genre or different title.</Text>}
    {compact && !expanded && tracks.length > 6 ? <Button title="Show more music" secondary onPress={() => setExpanded(true)} />
      : more && !loading && <Button title="Load more music" secondary onPress={() => void loadMore()} />}
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://audius.co').catch(() => setError('Could not open Audius.')); }} style={{ paddingVertical: 10 }}><Text style={{ color: c.blueText, fontSize: 12 }}>Explore the artists on Audius ↗</Text></Pressable>
  </View>;
}
