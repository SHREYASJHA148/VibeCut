import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Input, s } from './components';
import { colors as c } from './theme';
import { usePlayback } from './audio/player';
import { YouTubeFrame } from './YouTubeFrame';
import { youtubeError, youtubeId } from './youtube';

export function YouTubePanel({ query }: { query: string }) {
  const player = usePlayback();
  const [visible, setVisible] = useState(false), [input, setInput] = useState(''), [id, setId] = useState<string>();
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [retry, setRetry] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => { const listener = AppState.addEventListener('change', state => { setActive(state === 'active'); setReady(false); }); return () => listener.remove(); }, []);
  useEffect(() => {
    if (!visible || !id || ready || !active) return;
    const timer = setTimeout(() => setError('The YouTube player is taking too long to load. Check your connection and retry.'), 20000);
    return () => clearTimeout(timer);
  }, [visible, id, ready, active, retry]);
  const onReady = useCallback(() => { setReady(true); setError(''); }, []);
  const onError = useCallback((code: number) => { setReady(true); setError(youtubeError(code)); }, []);
  const load = () => {
    const video = youtubeId(input);
    if (!video) { setError('Paste a YouTube or YouTube Music video link. Playlist-only links are not supported.'); return; }
    player.releaseSession(); setError(''); setReady(false); setId(video); setRetry(v => v + 1);
  };
  const close = () => { setVisible(false); setId(undefined); setReady(false); setError(''); };
  return <>
    <Button title="Play a YouTube link" icon="logo-youtube" secondary onPress={() => {
      player.releaseSession(); setInput(youtubeId(query) ? query : ''); setVisible(true);
    }} />
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
        <View style={[s.between, { paddingHorizontal: 16 }]}><Text style={s.h2}>YouTube in VibeCut</Text><IconButton name="close" label="Close YouTube player" onPress={close} /></View>
        {id && active && <View style={{ width: '100%', height: 220, backgroundColor: '#000' }}>
          <YouTubeFrame key={`${id}:${retry}`} id={id} onReady={onReady} onError={onError} />
        </View>}
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.muted}>Paste a video link, then use YouTube’s play button below.</Text>
          <Input accessibilityLabel="YouTube video link" placeholder="https://music.youtube.com/watch?v=…" value={input} onChangeText={setInput} autoCorrect={false} autoCapitalize="none" keyboardType="url" />
          <Button title="Load YouTube video" onPress={load} disabled={!input.trim()} />
          {id && active && !ready && !error && <ActivityIndicator accessibilityLabel="Loading YouTube player" color={c.blueText} />}
          {!!error && <Text style={s.error}>{error}</Text>}
          {id && !!error && <Button title="Retry YouTube player" secondary onPress={() => { setError(''); setReady(false); setRetry(v => v + 1); }} />}
          {id && <Button title="Open video on YouTube" secondary icon="open-outline" onPress={() => { setId(undefined); void Linking.openURL(`https://www.youtube.com/watch?v=${id}`).catch(() => setError('Could not open YouTube.')); }} />}
          <Text style={[s.small, { lineHeight: 20 }]}>Videos play inside the official YouTube player. Some uploaders restrict embedding. Closing this screen or leaving the app stops the player.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
