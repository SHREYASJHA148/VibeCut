import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Art, Button, Empty, Icon, s, TrackRow } from '../components';
import { colors as c } from '../theme';
import { useLibrary } from '../state';
import { usePlayback } from '../audio/player';
import { Track } from '../model';
import { Catalog } from '../CatalogList';
export function Home({ library, editor, importAudio, options }: { library: () => void; editor: () => void; importAudio: () => void; options: (t: Track) => void }) {
  const { data } = useLibrary(), p = usePlayback();
  const hour = new Date().getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const recent = data.history.map(id => data.tracks.find(t => t.id === id)).filter((t): t is Track => !!t);
  const rotation = [...data.tracks].sort((a, b) => Number(data.likes.includes(b.id)) - Number(data.likes.includes(a.id))).slice(0, 5);
  return <ScrollView contentContainerStyle={s.content}>
    <View style={[s.between, { marginBottom: 6 }]}><View style={s.row}><View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.blue, justifyContent: 'center', alignItems: 'center' }}><Icon name="pulse" color="white" size={23} /></View><Text style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -1 }}>vibecut<Text style={{ color: c.pink }}>.</Text></Text></View><Text style={s.badge}>YOUR MUSIC. YOUR MIX.</Text></View>
    <View style={{ gap: 8 }}><Text style={s.muted}>{greeting}</Text><Text style={s.h1}>Find your next feeling.</Text></View>
    <Catalog compact />
    <View style={[s.card, { backgroundColor: '#101625', borderColor: '#202B46', paddingVertical: 27 }]}>
      <Text style={s.eyebrow}>MADE BY YOU</Text><Text style={[s.h1, { fontSize: 26, maxWidth: 260 }]}>{'Two tracks.\nA whole new mood.'}</Text><Text style={[s.muted, { maxWidth: 280, lineHeight: 22 }]}>Layer your favorites, find the perfect moment, and make it yours.</Text><View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Button title="Open the studio" icon="options-outline" onPress={editor} /></View>
    </View>
    {!data.tracks.length ? <Empty icon="musical-notes-outline" title="Your sound starts here" body="Bring your own music. Import audio to listen offline, build playlists, and create your first mashup."><Button title="Import audio" icon="add" onPress={importAudio} /></Empty> : <>
      {!!recent.length && <View style={{ gap: 15 }}><Text style={s.h2}>Pick up where you left off</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>{recent.slice(0, 6).map(track => <Pressable key={track.id} style={{ width: 126, gap: 6 }} onPress={() => p.play(track.id)}><Art track={track} size={126} /><Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text><Text style={s.small} numberOfLines={1}>{track.artist}</Text></Pressable>)}</ScrollView></View>}
      <View><View style={s.between}><Text style={s.h2}>On your rotation</Text><Pressable onPress={library} style={{ padding: 10 }}><Text style={{ color: c.blueText, fontSize: 12 }}>View library</Text></Pressable></View>{rotation.map(track => <TrackRow key={track.id} track={track} onOptions={() => options(track)} />)}</View>
    </>}
    <Pressable style={[s.card, s.row]} onPress={library}><Icon name="library-outline" color={c.pink} /><View style={s.flex}><Text style={s.trackTitle}>A collection that’s yours</Text><Text style={s.small}>{data.tracks.length} tracks · {data.playlists.length} playlists</Text></View><Icon name="chevron-forward" /></Pressable>
  </ScrollView>;
}
