import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Art, Empty, Input, s, TrackRow } from '../components';
import { colors as c } from '../theme';
import { useLibrary } from '../state';
import { getConfig } from '../config';
import { Metadata, searchMetadata } from '../metadata';
import { Track } from '../model';
import { Catalog } from '../CatalogList';
import { YouTubePanel } from '../YouTubePanel';
export function Search({ options }: { options: (t: Track) => void }) {
  const { data } = useLibrary(); const [query, setQuery] = useState(''), [kind, setKind] = useState<Metadata['kind']>('track');
  const [results, setResults] = useState<Metadata[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [online, setOnline] = useState(false);
  const [retry, setRetry] = useState(0), [detail, setDetail] = useState<Metadata>();
  useEffect(() => {
    const controller = new AbortController();
    const reset = setTimeout(() => { setResults([]); setError(''); setLoading(false); }, 0);
    void getConfig().then(config => { if (!controller.signal.aborted) setOnline(!!config.url); })
      .catch(() => { if (!controller.signal.aborted) setError('Check the metadata server address in Settings.'); });
    if (query.trim().length < 2) return () => { clearTimeout(reset); controller.abort(); };
    const timer = setTimeout(() => {
      setLoading(true);
      searchMetadata(query.trim(), kind, controller.signal).then(value => { if (!controller.signal.aborted) setResults(value); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Online search is unavailable.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);
    return () => { clearTimeout(reset); clearTimeout(timer); controller.abort(); };
  }, [query, kind, retry]);
  const local = data.tracks.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={{ gap: 8 }}><Text style={s.eyebrow}>FIND YOUR FREQUENCY</Text><Text style={s.h1}>Search</Text></View>
    <Input accessibilityLabel="Search music" placeholder="Tracks, artists, albums" value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
    <YouTubePanel query={query} />
    <View style={s.row}>{(['track', 'artist', 'album'] as const).map(k => <Pressable key={k} onPress={() => { setKind(k); setDetail(undefined); }} style={[s.chip, kind === k && { backgroundColor: c.elevated, borderColor: c.blue }]}><Text style={s.text}>{k[0].toUpperCase() + k.slice(1)}s</Text></Pressable>)}</View>
    {kind === 'track' && <Catalog key={query.trim()} query={query.trim()} />}
    {!online && kind !== 'track' && <View style={s.card}><Text style={s.text}>Artist and album information</Text><Text style={s.muted}>Connect a metadata server in Settings for artist and album details. Free playable music is available under Tracks.</Text></View>}
    {!!query.trim() && <View><Text style={s.h2}>In your library</Text>{local.map(track => <TrackRow key={track.id} track={track} onOptions={() => options(track)} />)}{!local.length && <Text style={[s.muted, { marginTop: 16 }]}>No imported tracks match this search.</Text>}</View>}
    {loading && <ActivityIndicator color={c.blueText} accessibilityLabel="Searching catalog" />}
    {!!error && <Pressable onPress={() => setRetry(v => v + 1)} style={s.card}><Text style={s.error}>{error}</Text><Text style={{ color: c.blueText }}>Tap to retry</Text></Pressable>}
    {!!results.length && <View style={{ gap: 8 }}><Text style={s.h2}>Online catalog</Text><Text style={s.small}>Metadata only · Import an audio file to listen</Text>{results.map(result => <Pressable key={result.id} onPress={() => setDetail(result)} style={[s.row, { paddingVertical: 9 }]}><Art track={result} /><View style={s.flex}><Text style={s.trackTitle}>{result.title}</Text><Text style={s.small}>{result.artist || result.kind}</Text></View></Pressable>)}</View>}
    {detail && <View style={s.card}><Text style={s.h2}>{detail.title}</Text><Text style={s.muted}>{detail.artist} · {detail.kind}</Text><Text style={s.muted}>This catalog entry has no authorized playback source. Import your own copy from the Library.</Text><Pressable onPress={() => { setQuery(detail.kind === 'artist' ? detail.title : detail.artist); setKind('track'); setDetail(undefined); }}><Text style={{ color: c.blueText }}>Search this artist’s tracks</Text></Pressable></View>}
    {online && query.length >= 2 && !loading && !error && !results.length && <Text style={s.muted}>No catalog results.</Text>}
    {!query && kind !== 'track' && <Empty icon="search-outline" title="A song in mind?" body="Search your collection or switch to Tracks to discover free music." />}
  </ScrollView>;
}
