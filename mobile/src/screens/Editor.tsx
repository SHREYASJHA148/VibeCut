import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Empty, IconButton, Input, s, Wave } from '../components';
import { colors as c } from '../theme';
import { useLibrary } from '../state';
import { usePlayback } from '../audio/player';
import { Clip, Project, Track, clamp, duration, normalizeClip, snap, splitClip, time, uid } from '../model';
import { mashup } from '../audio/mashup';
import { writeExport } from '../files';

function DragClip({ clip, track, scale, selected, select, change, begin }: {
  clip: Clip; track: Track; scale: number; selected: boolean; select: () => void; change: (c: Clip) => void; begin: () => void;
}) {
  const state = useRef({ clip, scale, change, select, begin });
  useEffect(() => { state.current = { clip, scale, change, select, begin }; }, [clip, scale, change, select, begin]);
  const original = useRef(clip);
  const responder = (mode: 'move' | 'in' | 'out') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { original.current = state.current.clip; state.current.begin(); state.current.select(); },
    onPanResponderMove: (_, gesture) => {
      const c = original.current, delta = gesture.dx / state.current.scale;
      state.current.change(mode === 'move' ? { ...c, start: c.start + delta } : mode === 'in'
        ? { ...c, in: c.in + delta, start: c.start + delta } : { ...c, out: c.out + delta });
    }, onPanResponderTerminationRequest: () => false,
  });
  // PanResponder stores callbacks; it does not execute these gesture handlers during render.
  // eslint-disable-next-line react-hooks/refs
  const move = useMemo(() => responder('move'), []), left = useMemo(() => responder('in'), []), right = useMemo(() => responder('out'), []);
  const width = Math.max(24, (clip.out - clip.in) * scale);
  const start = Math.floor(clip.in / track.duration * track.peaks.length), end = Math.ceil(clip.out / track.duration * track.peaks.length);
  return <View style={{ position: 'absolute', left: clip.start * scale, top: 9, width, height: 85, borderRadius: 8, overflow: 'hidden', backgroundColor: clip.muted ? '#222229' : '#172B55', borderWidth: selected ? 2 : 1, borderColor: selected ? c.pink : '#305799' }}>
    <View {...move.panHandlers} style={{ flex: 1, paddingHorizontal: 14, paddingTop: 7 }} accessibilityLabel={`Drag ${track.title} to move clip`}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{track.title}{clip.muted ? ' · muted' : ''}</Text>
      <Wave peaks={track.peaks.slice(start, end)} width={Math.max(1, width - 28)} height={50} color={clip.muted ? c.muted : c.blueText} />
    </View>
    {selected && <><View {...left.panHandlers} accessibilityLabel="Drag to trim start" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, backgroundColor: '#F7B6CB55', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text }}>│</Text></View>
      <View {...right.panHandlers} accessibilityLabel="Drag to trim end" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, backgroundColor: '#F7B6CB55', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text }}>│</Text></View></>}
  </View>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState((value / 1000).toFixed(2));
  useEffect(() => { const timer = setTimeout(() => setText((value / 1000).toFixed(2)), 0); return () => clearTimeout(timer); }, [value]);
  return <View style={s.flex}><Text style={s.small}>{label} (s)</Text><Input accessibilityLabel={label} keyboardType="decimal-pad" value={text} onChangeText={setText} onBlur={() => { const n = Number(text); if (Number.isFinite(n) && text.trim()) onChange(n * 1000); else setText((value / 1000).toFixed(2)); }} style={{ marginTop: 8 }} /></View>;
}
export function Editor({ id, close }: { id: string; close: () => void }) {
  const { data, update } = useLibrary(), player = usePlayback();
  const project = data.projects.find(p => p.id === id)!;
  const [selected, setSelected] = useState<string>(), [picking, setPicking] = useState(false), [zoom, setZoom] = useState(16);
  const [position, setPosition] = useState(0), [playing, setPlaying] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [snapping, setSnapping] = useState(true), [loop, setLoop] = useState(false), [loopIn, setLoopIn] = useState(0), [loopOut, setLoopOut] = useState(0);
  const undo = useRef<Project[]>([]), redo = useRef<Project[]>([]), latest = useRef(project);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  useEffect(() => { latest.current = project; }, [project]);
  const end = duration(project), scale = zoom / 1000, width = Math.max(650, (Math.min(300000, end + 15000)) * scale);
  const clip = project.clips.find(c => c.id === selected), track = data.tracks.find(t => t.id === clip?.trackId);
  const pause = () => { const wasPlaying = mashup.playing; mashup.pause(); if (wasPlaying) setPosition(mashup.position()); setPlaying(false); };
  const pausePlayer = useEffectEvent(() => player.releaseSession());
  useEffect(() => {
    pausePlayer(); mashup.onPause = () => { setPlaying(false); setPosition(mashup.position()); };
    return () => { mashup.onPause = undefined; void mashup.release(); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    let restarting = false;
    const timer = setInterval(() => {
      const at = mashup.position(); setPosition(at);
      if (at >= (loop && loopOut > loopIn ? loopOut : end) && !restarting) {
        if (loop) { restarting = true; mashup.play(latest.current, data.tracks, loopIn).then(() => { restarting = false; }).catch(e => { setError(e.message); pause(); }); }
        else pause();
      }
    }, 40);
    return () => clearInterval(timer);
  }, [playing, loop, loopIn, loopOut, end, data.tracks]);
  const save = (next: Project) => {
    // Invoked by event handlers and gesture callbacks, never while rendering.
    // eslint-disable-next-line react-hooks/purity
    const value = { ...next, updated: Date.now() };
    latest.current = value; setHistorySize({ undo: undo.current.length, redo: redo.current.length }); update(d => ({ ...d, projects: d.projects.map(p => p.id === id ? value : p) }));
  };
  const checkpoint = () => { pause(); undo.current = [...undo.current.slice(-24), latest.current]; redo.current = []; };
  const edit = (next: Clip, snapMove = false) => {
    const source = data.tracks.find(t => t.id === next.trackId); if (!source) return;
    save({ ...latest.current, clips: latest.current.clips.map(c => c.id === next.id ? normalizeClip({ ...next, start: snapMove ? snap(next.start, project.bpm, snapping) : next.start }, source.duration) : c) });
  };
  const start = async (at = position) => {
    if (!project.clips.length) return; setBusy('Preparing preview'); setError(''); player.pause();
    try { await mashup.play(latest.current, data.tracks, at >= end ? 0 : at); setPlaying(mashup.playing); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };
  const seek = (at: number) => { pause(); setPosition(clamp(at, 0, end)); };
  const add = (track: Track) => {
    if (track.source === 'audius') { setError('Streaming tracks are for listening. Import an audio file you have permission to remix.'); return; }
    if (project.clips.length >= 16) { setError('A project supports up to 16 clips across four lanes.'); return; }
    const sources = new Set(project.clips.map(c => c.trackId));
    if (sources.size >= 4 && !sources.has(track.id)) { setError('Use up to four source tracks per project.'); return; }
    checkpoint();
    const lanes = [0, 1, 2, 3].map(lane => ({ lane, end: Math.max(0, ...project.clips.filter(c => c.lane === lane).map(c => c.start + c.out - c.in)) }));
    const lane = lanes.sort((a, b) => a.end - b.end)[0];
    if (lane.end + 50 >= 300000) { setError('The timeline is full (five minutes).'); return; }
    const clip: Clip = { id: uid(), trackId: track.id, lane: lane.lane, start: lane.end, in: 0, out: Math.min(track.duration, 300000 - lane.end), volume: 1, muted: false, fadeIn: 0, fadeOut: 0 };
    save({ ...project, clips: [...project.clips, clip] }); setSelected(clip.id); setPicking(false);
  };
  const exportMix = async () => {
    pause(); setBusy('Rendering WAV'); setError('');
    try { const wav = await mashup.export(project, data.tracks); await writeExport(wav, project.name); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };
  return <SafeAreaView style={s.screen}>
    <View style={[s.between, { paddingHorizontal: 12 }]}><IconButton name="chevron-back" label="Close editor" onPress={close} /><Text style={s.eyebrow}>VIBECUT STUDIO</Text><IconButton name="share-outline" label="Export WAV" disabled={!!busy || !end} onPress={() => void exportMix()} /></View>
    <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 22, gap: 8 }}><Input accessibilityLabel="Project name" value={project.name} onChangeText={name => save({ ...project, name: name.slice(0, 70) })} onBlur={() => { if (!project.name.trim()) save({ ...project, name: 'Untitled mix' }); }} /><View style={s.between}><Text style={s.small}>Saved on this device · {time(end)}</Text><Text style={s.badge}>4 LANES · 5 MIN MAX</Text></View></View>
      <View style={[s.between, { paddingHorizontal: 12 }]}><View style={[s.row, { gap: 0 }]}><IconButton name={playing ? 'pause' : 'play'} label={playing ? 'Pause mix' : 'Play mix'} onPress={() => playing ? pause() : void start()} disabled={!!busy || !end} /><Text style={{ color: c.pink, fontVariant: ['tabular-nums'], fontSize: 18 }}>{time(position)}</Text></View><View style={[s.row, { gap: 0 }]}><IconButton name="magnet-outline" label="Toggle beat snap" active={snapping} onPress={() => setSnapping(v => !v)} /><IconButton name="repeat" label="Loop selected region or whole mix" active={loop} onPress={() => setLoop(v => !v)} /><IconButton name="remove" label="Zoom out" onPress={() => setZoom(v => Math.max(4, v / 1.5))} /><IconButton name="add" label="Zoom in" onPress={() => setZoom(v => Math.min(80, v * 1.5))} /></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ backgroundColor: '#101014' }}><View style={{ width }}>
        <Pressable accessibilityLabel="Seek on timeline ruler" onPress={e => seek(e.nativeEvent.locationX / scale)} style={{ height: 32, borderBottomWidth: 1, borderColor: c.border }}>
          {Array.from({ length: Math.ceil(width / (zoom * 5)) }, (_, i) => <Text pointerEvents="none" key={i} style={{ position: 'absolute', left: i * zoom * 5 + 3, color: c.muted, fontSize: 10, top: 8 }}>{time(i * 5000)}</Text>)}
        </Pressable>
        {[0, 1, 2, 3].map(lane => <View key={lane} style={{ height: 104, borderBottomWidth: 1, borderColor: c.border }}>
          <Text pointerEvents="none" style={{ position: 'absolute', left: 10, top: 43, color: '#666675', fontSize: 11 }}>LANE {lane + 1}</Text>
          {project.clips.filter(c => c.lane === lane).map(clip => { const track = data.tracks.find(t => t.id === clip.trackId); return track && <DragClip key={clip.id} clip={clip} track={track} scale={scale} selected={selected === clip.id} select={() => setSelected(clip.id)} begin={checkpoint} change={c => edit(c, true)} />; })}
        </View>)}
        <View pointerEvents="none" style={{ position: 'absolute', width: 1, left: position * scale, backgroundColor: c.pink, top: 0, bottom: 0 }} />
      </View></ScrollView>
      <View style={{ paddingHorizontal: 22, gap: 16 }}>
        <View style={s.between}><Button title="Add audio" secondary icon="add" disabled={!!busy} onPress={() => setPicking(true)} /><View style={s.row}><IconButton name="arrow-undo" label="Undo edit" disabled={!historySize.undo || !!busy} onPress={() => { pause(); redo.current.push(project); save(undo.current.pop()!); }} /><IconButton name="arrow-redo" label="Redo edit" disabled={!historySize.redo || !!busy} onPress={() => { pause(); undo.current.push(project); save(redo.current.pop()!); }} /></View></View>
        {!!busy && <View style={s.row}><ActivityIndicator color={c.blueText} /><Text style={s.muted}>{busy}…</Text></View>}{!!error && <Text style={s.error}>{error}</Text>}
        {!project.clips.length && <Text style={[s.muted, { lineHeight: 22 }]}>Add a track to each lane. Drag clips to move them and use the pink handles to trim. Tap the ruler to seek.</Text>}
        <View style={s.card}><View style={s.between}><Text style={s.text}>Project tempo</Text><Text style={s.small}>Manual grid · no time stretching</Text></View><View style={s.row}><Button title="÷2" secondary onPress={() => { checkpoint(); save({ ...project, bpm: Math.max(30, project.bpm / 2) }); }} /><Input accessibilityLabel="Project BPM" keyboardType="decimal-pad" key={project.bpm} defaultValue={String(project.bpm)} onEndEditing={e => { const n = Number(e.nativeEvent.text); if (Number.isFinite(n) && n >= 30 && n <= 300) { checkpoint(); save({ ...project, bpm: n }); } else setError('Tempo must be between 30 and 300 BPM.'); }} style={s.flex} /><Button title="×2" secondary onPress={() => { checkpoint(); save({ ...project, bpm: Math.min(300, project.bpm * 2) }); }} /></View></View>
        {loop && <View style={s.card}><Text style={s.text}>Loop region</Text><View style={s.row}><NumberField label="Loop start" value={loopIn} onChange={v => { pause(); setLoopIn(clamp(v, 0, Math.max(0, end - 50))); }} /><NumberField label="Loop end" value={loopOut || end} onChange={v => { pause(); setLoopOut(clamp(v, loopIn + 50, end)); }} /></View><Text style={s.small}>Loop restarts have a short scheduling gap.</Text></View>}
        {clip && track && <View style={s.card}><View style={s.between}><Text style={[s.h2, s.flex]} numberOfLines={1}>{track.title}</Text><Text style={s.badge}>{track.bpm ? `~${track.bpm} BPM` : 'BPM unknown'}</Text></View>
          <Text style={s.small}>Precise controls · all times in seconds</Text>
          <View style={s.row}><NumberField label="Position" value={clip.start} onChange={v => { checkpoint(); edit({ ...clip, start: snap(v, project.bpm, snapping) }); }} /><NumberField label="Source in" value={clip.in} onChange={v => { checkpoint(); edit({ ...clip, in: v }); }} /><NumberField label="Source out" value={clip.out} onChange={v => { checkpoint(); edit({ ...clip, out: v }); }} /></View>
          <View style={s.between}><Text style={s.text}>Volume</Text><Text style={s.small}>{Math.round(clip.volume * 100)}%</Text><IconButton name={clip.muted ? 'volume-mute' : 'volume-high'} label="Toggle clip mute" active={clip.muted} onPress={() => { checkpoint(); edit({ ...clip, muted: !clip.muted }); }} /></View>
          <Slider accessibilityLabel="Clip volume" minimumValue={0} maximumValue={1} value={clip.volume} minimumTrackTintColor={c.blue} thumbTintColor={c.text} onSlidingStart={checkpoint} onValueChange={v => edit({ ...clip, volume: v })} />
          <View style={s.row}><NumberField label="Fade in" value={clip.fadeIn} onChange={v => { checkpoint(); edit({ ...clip, fadeIn: v }); }} /><NumberField label="Fade out" value={clip.fadeOut} onChange={v => { checkpoint(); edit({ ...clip, fadeOut: v }); }} /></View>
          <View style={s.row}><Button title="Split at playhead" secondary disabled={project.clips.length >= 16} onPress={() => { const pair = splitClip(clip, Math.round(position)); if (!pair) { setError('Place the playhead inside the clip, away from its edges.'); return; } checkpoint(); save({ ...project, clips: project.clips.flatMap(c => c.id === clip.id ? pair : [c]) }); }} /><IconButton name="trash-outline" label="Delete clip" onPress={() => { checkpoint(); save({ ...project, clips: project.clips.filter(c => c.id !== clip.id) }); setSelected(undefined); }} /></View>
        </View>}
        <Text style={[s.small, { lineHeight: 18 }]}>Preview and export use the same gain and timing. Fixed mix headroom prevents clipping. Studio preview pauses when the app leaves the foreground.</Text>
      </View>
    </ScrollView>
    <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}><SafeAreaView style={s.screen}><View style={[s.between, { paddingHorizontal: 22 }]}><Text style={s.h2}>Choose audio</Text><IconButton name="close" label="Close audio picker" onPress={() => setPicking(false)} /></View><ScrollView contentContainerStyle={s.content}>{data.tracks.filter(t => t.source !== 'audius').map(t => <Pressable key={t.id} style={s.card} onPress={() => add(t)}><Text style={s.trackTitle}>{t.title}</Text><Text style={s.small}>{t.artist} · {time(t.duration)}</Text></Pressable>)}{!data.tracks.some(t => t.source !== 'audius') && <Empty icon="musical-notes-outline" title="Import audio for the studio" body="Close the studio and import audio from your Library first." />}</ScrollView></SafeAreaView></Modal>
  </SafeAreaView>;
}
