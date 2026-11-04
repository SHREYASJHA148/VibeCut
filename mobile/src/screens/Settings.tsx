import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button, Input, s } from '../components';
import { getConfig, saveConfig } from '../config';
import { colors as c } from '../theme';
import { boundedJson } from '../security';
export function Settings() {
  const [url, setUrl] = useState(''), [token, setToken] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { getConfig().then(config => { setUrl(config.url); setToken(config.token); }).catch(() => setMessage('Could not read server settings.')); }, []);
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await saveConfig(url, token);
      const config = await getConfig();
      if (url.trim()) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
        try { const result = await fetch(`${config.url}/health`, { headers: { Authorization: `Bearer ${config.token}` }, redirect: 'error', signal: controller.signal });
          if (!result.ok) throw new Error(`Server returned ${result.status}. Check your address and access token.`);
          const health = await boundedJson(result, 65536); setMessage(health.metadata ? 'Connected. Online metadata search is ready.' : 'Connected. Add LASTFM_API_KEY to the server to enable online search.');
        } finally { clearTimeout(timer); }
      } else setMessage('Saved. Your library works without a server.');
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.h1}>Settings</Text>
    <View style={s.card}><Text style={s.h2}>Free music, ready to play</Text><Text style={[s.muted, { lineHeight: 22 }]}>Home and Tracks search stream free full-length music from Audius. No account or API key is needed. Online tracks need an internet connection and are saved as links, not offline files. Import your own authorized files to use the mashup studio.</Text></View>
    <View style={s.card}><Text style={s.h2}>Optional catalog information</Text><Text style={[s.muted, { lineHeight: 22 }]}>Connect your private VibeCut server for additional Last.fm track, artist and album information. Audius playback works without this server.</Text><Input accessibilityLabel="Metadata server URL" placeholder="https://your-server.example" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl} /><Input accessibilityLabel="Server access token" placeholder="Server access token" secureTextEntry autoCapitalize="none" autoCorrect={false} value={token} onChangeText={setToken} /><Button title="Save and test connection" disabled={busy} onPress={() => void save()} />{busy && <ActivityIndicator color={c.blueText} />}{!!message && <Text style={[s.muted, { lineHeight: 22 }]}>{message}</Text>}</View>
    <View style={s.card}><Text style={s.h2}>Made for your music</Text><Text style={[s.muted, { lineHeight: 22 }]}>Supported imports depend on your device’s decoder: WAV, MP3, M4A and AAC are common choices. Use files you have permission to edit. Files must be under 40 MB and five minutes.{'\n\n'}The studio supports four source tracks, four lanes and sixteen clips. Export is stereo WAV at 44.1 kHz. Loop previews include a brief restart gap. Beat detection is an estimate; adjust the tempo manually when needed.</Text></View>
    <Text style={s.small}>VibeCut 1.0 · Local first · No analytics</Text>
  </ScrollView>;
}
