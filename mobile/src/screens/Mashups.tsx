import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Empty, Icon, IconButton, s } from '../components';
import { useLibrary } from '../state';
import { colors as c } from '../theme';
import { time, duration, uid } from '../model';
export function Mashups({ open }: { open: (id: string) => void }) {
  const { data, update } = useLibrary();
  const create = () => { const id = uid(); update(d => ({ ...d, projects: [{ id, name: 'Untitled mix', bpm: 120, clips: [], updated: Date.now() }, ...d.projects] })); open(id); };
  return <ScrollView contentContainerStyle={s.content}>
    <View style={{ gap: 8 }}><Text style={s.eyebrow}>A LITTLE LESS ORDINARY</Text><Text style={s.h1}>Your studio</Text><Text style={s.muted}>Good things happen between tracks.</Text></View>
    <Button title="Create a mashup" icon="add" onPress={create} />
    {!data.projects.length && <Empty icon="options-outline" title="Make something only you would" body="Up to four tracks. A shared timeline. Trim, layer and shape your sound, then export a WAV to keep." />}
    {data.projects.map(project => <View key={project.id} style={s.card}><Pressable onPress={() => open(project.id)} style={s.row}><View style={{ padding: 14, backgroundColor: '#172039', borderRadius: 13 }}><Icon name="pulse" color={c.blueText} size={30} /></View><View style={s.flex}><Text style={s.h2}>{project.name}</Text><Text style={s.small}>{project.clips.length} clips · {time(duration(project))} · {project.bpm} BPM</Text><Text style={s.small}>Edited {new Date(project.updated).toLocaleDateString()}</Text></View><Icon name="chevron-forward" /></Pressable><View style={s.between}><Text style={s.small}>Saved on this device</Text><IconButton name="trash-outline" label={`Delete ${project.name}`} onPress={() => update(d => ({ ...d, projects: d.projects.filter(p => p.id !== project.id) }))} /></View></View>)}
  </ScrollView>;
}
