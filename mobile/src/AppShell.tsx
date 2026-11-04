import React, { useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LibraryProvider, useLibrary } from './state';
import { PlayerProvider, usePlayback } from './audio/player';
import { Button, Icon, IconButton, IconName, Input, s } from './components';
import { colors as c } from './theme';
import { Track, uid } from './model';
import { mashup } from './audio/mashup';
import { keepAudio, pickAudio, removeFile } from './files';
import { Home } from './screens/Home';
import { Search } from './screens/Search';
import { LibraryScreen } from './screens/Library';
import { Mashups } from './screens/Mashups';
import { Editor } from './screens/Editor';
import { Settings } from './screens/Settings';
import { MiniPlayer, PlayerModal } from './screens/Player';

const tabs: { name: string; icon: IconName }[] = [{ name: 'Home', icon: 'home-outline' }, { name: 'Search', icon: 'search-outline' }, { name: 'Library', icon: 'library-outline' }, { name: 'Studio', icon: 'options-outline' }];
function Shell() {
  const { data, update, ready, error, clearError } = useLibrary(), player = usePlayback();
  const [tab, setTab] = useState('Home'), [fullPlayer, setFullPlayer] = useState(false), [editor, setEditor] = useState<string>();
  const [settings, setSettings] = useState(false), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [optionId, setOptionId] = useState<string>(), [title, setTitle] = useState(''), [artist, setArtist] = useState(''), [confirmRemove, setConfirmRemove] = useState(false);
  const option = data.tracks.find(t => t.id === optionId);
  React.useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (tab !== 'Home') { setTab('Home'); return true; } return false; }); return () => listener.remove(); }, [tab]);
  const openOptions = (track: Track) => { setOptionId(track.id); setTitle(track.title); setArtist(track.artist); setConfirmRemove(false); };
  const importAudio = async () => {
    setNotice('');
    try {
      const assets = await pickAudio(); if (!assets.length) return; player.pause();
      const failures: string[] = []; let imported = 0;
      for (const asset of assets.slice(0, 12)) {
        setBusy(`Importing ${asset.name}`); let uri: string | undefined;
        try {
          uri = await keepAudio(asset); const id = uid();
          const analysis = await mashup.analyze({ id, uri });
          const base = asset.name.replace(/\.[^.]+$/, ''), parts = base.split(' - ');
          const track: Track = { id, uri, title: parts.length > 1 ? parts.slice(1).join(' - ') : base, artist: parts.length > 1 ? parts[0] : 'Local audio', ...analysis, bytes: asset.size ?? 0 };
          update(d => ({ ...d, tracks: [...d.tracks, track] })); imported++;
        } catch (e) { if (uri) await removeFile(uri).catch(() => {}); failures.push(`${asset.name}: ${e instanceof Error ? e.message : 'Could not decode this format.'}`); }
      }
      await mashup.release();
      setNotice(`${imported} file${imported === 1 ? '' : 's'} imported.${assets.length > 12 ? ' Import is limited to 12 files at a time.' : ''}${failures.length ? `\n${failures.join('\n')}` : ''}`); setTab('Library');
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };
  const removeTrack = async () => {
    if (!option) return;
    if (data.projects.some(p => p.clips.some(c => c.trackId === option.id))) { setNotice('This track is used in a mashup. Remove its clips before deleting the file.'); setOptionId(undefined); return; }
    try { if (player.track?.id === option.id) player.pause(); if (option.source !== 'audius') await removeFile(option.uri);
      update(d => ({ ...d, tracks: d.tracks.filter(t => t.id !== option.id), likes: d.likes.filter(id => id !== option.id), history: d.history.filter(id => id !== option.id), queue: d.queue.filter(id => id !== option.id), current: d.current === option.id ? undefined : d.current, position: d.current === option.id ? 0 : d.position, playlists: d.playlists.map(p => ({ ...p, trackIds: p.trackIds.filter(id => id !== option.id) })) })); setOptionId(undefined);
    } catch { setNotice('The file could not be removed. Try again.'); }
  };
  if (!ready) return <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={c.blueText} /><Text style={[s.muted, { marginTop: 16 }]}>Opening your collection…</Text></View>;
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}><StatusBar style="light" />
    <View style={{ flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <View style={{ position: 'absolute', top: 5, right: 12, zIndex: 2 }}><IconButton name="settings-outline" label="Open settings" onPress={() => setSettings(true)} /></View>
      <View style={{ height: 30 }} />
      <View style={s.flex}>{tab === 'Home' ? <Home library={() => setTab('Library')} editor={() => setTab('Studio')} importAudio={() => void importAudio()} options={openOptions} />
        : tab === 'Search' ? <Search options={openOptions} /> : tab === 'Library' ? <LibraryScreen importAudio={() => void importAudio()} options={openOptions} /> : <Mashups open={setEditor} />}</View>
      {(!!notice || !!error || !!player.error) && <View style={{ backgroundColor: '#25202A', paddingHorizontal: 16, paddingVertical: 10 }}><View style={s.row}><Text style={[s.text, s.flex, { fontSize: 12 }]}>{error || notice || player.error}</Text><IconButton name="close" label="Dismiss notice" onPress={() => { clearError(); setNotice(''); }} /></View></View>}
      <MiniPlayer open={() => setFullPlayer(true)} />
      <View style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: 4 }}>{tabs.map(item => <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{ selected: tab === item.name }} accessibilityLabel={item.name} onPress={() => setTab(item.name)} style={{ flex: 1, minHeight: 57, alignItems: 'center', justifyContent: 'center', gap: 5 }}><Icon name={item.icon} color={tab === item.name ? c.blueText : c.muted} size={23} /><Text style={{ color: tab === item.name ? c.text : c.muted, fontSize: 10, fontWeight: tab === item.name ? '600' : '400' }}>{item.name}</Text></Pressable>)}</View>
    </View>
    <PlayerModal visible={fullPlayer} close={() => setFullPlayer(false)} />
    <Modal visible={!!editor} animationType="slide" onRequestClose={() => setEditor(undefined)}>{editor && data.projects.some(p => p.id === editor) && <Editor id={editor} close={() => setEditor(undefined)} />}</Modal>
    <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}><SafeAreaView style={s.screen}><View style={{ alignItems: 'flex-end', paddingHorizontal: 12 }}><IconButton name="close" label="Close settings" onPress={() => setSettings(false)} /></View><Settings /></SafeAreaView></Modal>
    <Modal visible={!!option} animationType="slide" onRequestClose={() => setOptionId(undefined)}><SafeAreaView style={s.screen}><View style={[s.between, { paddingHorizontal: 22 }]}><Text style={s.h2}>Track options</Text><IconButton name="close" label="Close track options" onPress={() => setOptionId(undefined)} /></View>{option && <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Input accessibilityLabel="Track title" value={title} onChangeText={setTitle} maxLength={150} /><Input accessibilityLabel="Track artist" value={artist} onChangeText={setArtist} maxLength={150} /><Button title="Save details" disabled={!title.trim() || !artist.trim()} onPress={() => { update(d => ({ ...d, tracks: d.tracks.map(t => t.id === option.id ? { ...t, title: title.trim(), artist: artist.trim() } : t) })); setOptionId(undefined); }} />
      <View style={s.row}><Button title="Play next" secondary onPress={() => { update(d => { const queue = d.queue.filter(id => id !== option.id), index = queue.indexOf(d.current ?? ''); queue.splice(index + 1, 0, option.id); return { ...d, queue }; }); setOptionId(undefined); }} /><Button title={data.queue.includes(option.id) ? "Already queued" : "Add to queue"} disabled={data.queue.includes(option.id)} secondary onPress={() => { update(d => ({ ...d, queue: [...d.queue, option.id] })); setOptionId(undefined); }} /></View>
      <Text style={s.h2}>Add to playlist</Text>{data.playlists.length ? data.playlists.map(p => <Button key={p.id} title={p.trackIds.includes(option.id) ? `${p.name} · added` : p.name} secondary disabled={p.trackIds.includes(option.id)} onPress={() => update(d => ({ ...d, playlists: d.playlists.map(list => list.id === p.id ? { ...list, trackIds: [...list.trackIds, option.id] } : list) }))} />) : <Text style={s.muted}>Create a playlist in your Library first.</Text>}
      {confirmRemove && <Text style={s.error}>{option.source === 'audius' ? 'This removes the online track from your library.' : 'This removes the imported copy from VibeCut. Your original file is kept.'}</Text>}<Button title={confirmRemove ? 'Confirm removal' : 'Remove from library'} secondary icon="trash-outline" onPress={() => confirmRemove ? void removeTrack() : setConfirmRemove(true)} />
    </ScrollView>}</SafeAreaView></Modal>
    <Modal transparent visible={!!busy} animationType="fade"><View style={{ flex: 1, backgroundColor: '#000C', justifyContent: 'center', padding: 30 }}><View style={s.card}><ActivityIndicator color={c.blueText} /><Text style={[s.text, { textAlign: 'center' }]}>{busy}</Text><Text style={[s.small, { textAlign: 'center' }]}>Reading audio and building its waveform</Text></View></View></Modal>
  </SafeAreaView>;
}
export default function AppShell() { return <SafeAreaProvider><LibraryProvider><PlayerProvider><Shell /></PlayerProvider></LibraryProvider></SafeAreaProvider>; }
