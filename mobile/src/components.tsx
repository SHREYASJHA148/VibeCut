import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Line, Path } from 'react-native-svg';
import { colors as c } from './theme';
import { Track, time } from './model';
import { useLibrary } from './state';
import { usePlayback } from './audio/player';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, color = c.muted, size = 22 }: { name: IconName; color?: string; size?: number }) { return <Ionicons name={name} color={color} size={size} />; }
export function IconButton({ name, label, onPress, active, disabled }: { name: IconName; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.iconButton, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}><Icon name={name} color={active ? c.blueText : c.text} /></Pressable>;
}
export function Button({ title, onPress, icon, secondary, disabled }: { title: string; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? .4 : pressed ? .7 : 1 }]}>
    {icon && <Icon name={icon} color={c.text} size={19} />}<Text style={s.buttonText}>{title}</Text></Pressable>;
}
export function Input(props: React.ComponentProps<typeof TextInput>) {
  // React Native Web omits onEndEditing; its blur event includes the input text.
  const webEnd = Platform.OS === 'web' && props.onEndEditing ? { onBlur: props.onEndEditing as React.ComponentProps<typeof TextInput>['onBlur'] } : {};
  return <TextInput placeholderTextColor={c.muted} {...props} {...webEnd} style={[s.input, props.style]} />;
}
export function Empty({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: React.ReactNode }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name={icon} color={c.blueText} size={30} /></View><Text style={s.h2}>{title}</Text><Text style={[s.muted, { textAlign: 'center', lineHeight: 22 }]}>{body}</Text>{children}</View>;
}
export function Art({ track, size = 52 }: { track?: Pick<Track, 'artwork' | 'title'>; size?: number }) {
  if (track?.artwork) return <Image source={{ uri: track.artwork }} style={{ width: size, height: size, borderRadius: size / 8 }} />;
  return <View style={[s.art, { width: size, height: size, borderRadius: size / 8 }]}>
    <Svg width={size * .7} height={size * .7} viewBox="0 0 100 100">
      {[20, 30, 40, 50, 60, 70, 80].map((x, i) => <Line key={x} x1={x} x2={x} y1={50 - [10, 21, 30, 17, 35, 24, 9][i]} y2={50 + [10, 21, 30, 17, 35, 24, 9][i]} stroke={i === 4 ? c.pink : c.blueText} strokeWidth={5} strokeLinecap="round" />)}
    </Svg></View>;
}
export function Wave({ peaks, width, height = 60, color = c.blueText }: { peaks: number[]; width: number; height?: number; color?: string }) {
  const step = Math.max(1, Math.floor(peaks.length / Math.max(1, width / 3)));
  let path = '';
  for (let i = 0; i < peaks.length; i += step) { const x = i / peaks.length * width, half = Math.max(1, peaks[i] * height / 2); path += `M${x},${height / 2 - half}V${height / 2 + half}`; }
  return <Svg pointerEvents="none" width={width} height={height}><Path d={path} stroke={color} strokeWidth={1.5} /></Svg>;
}
export function TrackRow({ track, onOptions, queue }: { track: Track; onOptions?: () => void; queue?: string[] }) {
  const player = usePlayback(); const { data, update } = useLibrary(); const active = player.track?.id === track.id;
  return <View style={s.trackRow}><Pressable accessibilityRole="button" accessibilityLabel={`Play ${track.title}`} onPress={() => player.play(track.id, queue ?? data.tracks.map(t => t.id))} style={s.trackMain}>
    <Art track={track} /><View style={s.flex}><Text numberOfLines={1} style={[s.trackTitle, active && { color: c.blueText }]}>{track.title}</Text><Text numberOfLines={1} style={s.small}>{track.artist} · {time(track.duration)}{track.source === 'audius' ? ' · Online' : ''}</Text></View>
    {active && player.playing && <Icon name="volume-medium" color={c.blueText} size={18} />}</Pressable>
    <IconButton name={data.likes.includes(track.id) ? 'heart' : 'heart-outline'} label="Save track" active={data.likes.includes(track.id)} onPress={() => update(d => ({ ...d, likes: d.likes.includes(track.id) ? d.likes.filter(id => id !== track.id) : [...d.likes, track.id] }))} />
    {onOptions && <IconButton name="ellipsis-horizontal" label={`Options for ${track.title}`} onPress={onOptions} />}</View>;
}
export const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: c.bg }, content: { padding: 22, gap: 22, paddingBottom: 35 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  h1: { color: c.text, fontSize: 29, fontWeight: '700', letterSpacing: -.8 }, h2: { color: c.text, fontSize: 19, fontWeight: '600', letterSpacing: -.3 },
  text: { color: c.text, fontSize: 15 }, muted: { color: c.muted, fontSize: 14 }, small: { color: c.muted, fontSize: 12, marginTop: 5 },
  eyebrow: { color: c.blueText, fontSize: 11, fontWeight: '700', letterSpacing: 2.2 },
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 20, gap: 14, borderWidth: 1, borderColor: '#202026' },
  button: { minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: c.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondary: { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }, buttonText: { color: c.text, fontWeight: '600', fontSize: 14 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.text, paddingHorizontal: 15, paddingVertical: 13, fontSize: 15, minHeight: 48 },
  empty: { alignItems: 'center', paddingVertical: 35, paddingHorizontal: 15, gap: 16 }, emptyIcon: { backgroundColor: c.elevated, borderRadius: 23, padding: 20 },
  art: { backgroundColor: '#172039', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  trackRow: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 2 }, trackMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 8 },
  trackTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: c.border },
  badge: { color: c.blueText, backgroundColor: '#172039', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: '600', overflow: 'hidden' },
  error: { color: c.error, fontSize: 13, lineHeight: 20 },
  chip: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 22 },
  overlay: { flex: 1, backgroundColor: c.bg },
});
