import React from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Art, IconButton, s } from '../components';
import { colors as c } from '../theme';
import { time } from '../model';
import { usePlayback } from '../audio/player';
import { useLibrary } from '../state';

export function MiniPlayer({ open }: { open: () => void }) {
  const p = usePlayback(); if (!p.track) return null;
  return <View style={{ backgroundColor: c.elevated, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden' }}>
    <View style={[s.row, { paddingHorizontal: 8, gap: 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open player" onPress={open} style={[s.row, s.flex, { paddingVertical: 9 }]}>
        <Art track={p.track} size={40} /><View style={s.flex}><Text style={s.trackTitle} numberOfLines={1}>{p.track.title}</Text><Text style={s.small}>{p.loading ? 'Loading audio…' : p.track.artist}</Text></View></Pressable>
      <IconButton name={p.playing ? 'pause' : 'play'} label={p.playing ? 'Pause' : 'Play'} onPress={p.toggle} disabled={p.loading} />
      <IconButton name="play-skip-forward" label="Next track" onPress={p.next} />
    </View><View style={{ height: 2, width: `${Math.min(100, p.position / (p.total || 1) * 100)}%`, backgroundColor: c.blue }} />
  </View>;
}
export function PlayerModal({ visible, close }: { visible: boolean; close: () => void }) {
  const p = usePlayback(); const { data, update } = useLibrary();
  const reorder = (index: number, delta: number) => update(d => { const queue = [...d.queue]; [queue[index], queue[index + delta]] = [queue[index + delta], queue[index]]; return { ...d, queue }; });
  return <Modal visible={visible} animationType="slide" onRequestClose={close}><SafeAreaView style={s.screen}>
    <View style={[s.between, { paddingHorizontal: 15 }]}><IconButton name="chevron-down" label="Close player" onPress={close} /><Text style={s.eyebrow}>NOW PLAYING</Text><View style={{ width: 44 }} /></View>
    <ScrollView contentContainerStyle={[s.content, { alignItems: 'center' }]}>
      {p.track && <><Art track={p.track} size={280} /><View style={{ width: '100%', marginTop: 12 }}>
        <Text style={s.h1}>{p.track.title}</Text><Text style={[s.muted, { marginTop: 8 }]}>{p.track.artist}</Text>
        {p.track.source === 'audius' && <Pressable accessibilityRole="link" onPress={() => { if (p.track?.sourceUrl) void Linking.openURL(p.track.sourceUrl).catch(() => {}); }} style={{ paddingVertical: 12 }}><Text style={{ color: c.blueText, fontSize: 12 }}>Music via Audius · View artist and track ↗</Text></Pressable>}</View>
        <View style={{ width: '100%' }}><Slider accessibilityLabel="Playback position" minimumValue={0} maximumValue={Math.max(1, p.total)} value={p.position} onSlidingComplete={p.seek} minimumTrackTintColor={c.blue} maximumTrackTintColor={c.border} thumbTintColor={c.text} />
          <View style={s.between}><Text style={s.small}>{time(p.position)}</Text><Text style={s.small}>{time(p.total)}</Text></View></View>
        {p.loading && <Text style={s.muted}>Loading audio…</Text>}{p.error && <Text style={s.error}>{p.error}</Text>}
        <View style={[s.between, { width: '100%' }]}>
          <IconButton name="shuffle" label="Toggle shuffle" active={p.shuffle} onPress={p.setShuffle} />
          <IconButton name="play-skip-back" label="Previous track" onPress={p.previous} />
          <View style={{ borderRadius: 40, backgroundColor: c.blue, padding: 12 }}><IconButton name={p.playing ? 'pause' : 'play'} label={p.playing ? 'Pause audio' : 'Play audio'} onPress={p.toggle} disabled={p.loading} /></View>
          <IconButton name="play-skip-forward" label="Next track" onPress={p.next} />
          <View><IconButton name="repeat" label={`Repeat ${p.repeat}. Change repeat mode`} active={p.repeat !== 'off'} onPress={p.setRepeat} />{p.repeat === 'one' && <Text style={{ color: c.blueText, position: 'absolute', right: 5, top: 0 }}>1</Text>}</View>
        </View>
        <View style={{ width: '100%', gap: 12, marginTop: 20 }}><View style={s.between}><Text style={s.h2}>Your queue</Text><Text style={s.small}>{data.queue.length} tracks</Text></View>
          {data.queue.map((id, index) => { const track = data.tracks.find(t => t.id === id); return track ? <View key={`${id}-${index}`} style={s.row}>
            <Pressable style={s.flex} onPress={() => p.play(id)}><Text style={[s.text, id === data.current && { color: c.blueText }]} numberOfLines={1}>{track.title}</Text><Text style={s.small}>{track.artist}</Text></Pressable>
            <IconButton name="arrow-up" label="Move earlier" disabled={!index} onPress={() => reorder(index, -1)} />
            <IconButton name="arrow-down" label="Move later" disabled={index === data.queue.length - 1} onPress={() => reorder(index, 1)} />
            <IconButton name="close" label="Remove from queue" onPress={() => update(d => ({ ...d, queue: d.queue.filter((_, i) => i !== index) }))} /></View> : null; })}
        </View></>}
    </ScrollView></SafeAreaView></Modal>;
}
