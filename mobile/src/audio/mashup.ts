import { AudioContext, OfflineAudioContext, AudioBuffer, AudioBufferSourceNode, GainNode, getAudioDuration } from 'react-native-audio-api';
import { AppState } from 'react-native';
import { Track, Project, duration, envelope, gainAt, schedule } from '../model';
import { analyzeSamples } from '../analysis';
import { encodeWav } from '../wav';
import { resolveUri } from '../uri';
import { validProject } from '../libraryValidation';

type Graph = Pick<AudioContext, 'createBufferSource' | 'createGain' | 'destination'>;
class MashupEngine {
  private context?: AudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private nodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private base = 0;
  private offset = 0;
  private end = 0;
  private generation = 0;
  playing = false;
  onPause?: () => void;
  constructor() {
    AppState.addEventListener('change', state => { if (state !== 'active' && this.playing) { this.pause(); this.onPause?.(); } });
  }
  private getContext() { return this.context ??= new AudioContext({ sampleRate: 44100 }); }
  async load(track: Pick<Track, 'id' | 'uri'> & Pick<Partial<Track>, 'source'>) {
    if (track.source === 'audius' || /^https?:/i.test(track.uri)) throw new Error('Import an authorized local file to use it in a mashup.');
    const cached = this.buffers.get(track.id); if (cached) return cached;
    const pending = this.pending.get(track.id); if (pending) return pending;
    const decode = this.decode(track); this.pending.set(track.id, decode);
    try { return await decode; } finally { this.pending.delete(track.id); }
  }
  private async decode(track: Pick<Track, 'id' | 'uri'>) {
    const generation = this.generation;
    const uri = await resolveUri(track.uri);
    const seconds = await getAudioDuration(uri);
    if (!Number.isFinite(seconds) || seconds < .05 || seconds > 300.1) throw new Error('Choose audio between 0.05 seconds and five minutes long.');
    const buffer = await this.getContext().decodeAudioData(uri);
    if (buffer.numberOfChannels > 2) throw new Error('Import mono or stereo audio for the studio.');
    if (buffer.duration > 300.1) throw new Error('Audio must be five minutes or shorter.');
    // Bound decoded-memory usage to four tracks; graphs keep active buffers alive.
    if (this.buffers.size >= 4) this.buffers.delete(this.buffers.keys().next().value!);
    if (generation === this.generation) this.buffers.set(track.id, buffer); return buffer;
  }
  async analyze(track: Pick<Track, 'id' | 'uri'>) {
    const buffer = await this.load(track);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return { ...analyzeSamples(channels, buffer.sampleRate), duration: Math.round(buffer.duration * 1000) };
  }
  private async graph(context: Graph, project: Project, tracks: Track[], position: number, clock: number, valid = () => true) {
    const items = schedule(project, position);
    const buffers = await Promise.all(items.map(item => {
      const track = tracks.find(t => t.id === item.clip.trackId);
      if (!track) throw new Error('A source track is missing. Remove its clip or import the source again.');
      return this.load(track);
    }));
    if (!valid()) return [];
    return items.map((item, i) => {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[i]; source.connect(gain); gain.connect(context.destination);
      const points = envelope(item.clip), at = clock + item.when;
      // Fixed headroom is identical in preview and export, independent of mute state.
      const headroom = 1 / Math.max(1, project.clips.length);
      gain.gain.setValueAtTime(gainAt(points, item.elapsed) * headroom, at);
      for (const [t, value] of points) if (t > item.elapsed)
        gain.gain.linearRampToValueAtTime(value * headroom, at + t - item.elapsed);
      source.start(at, item.offset, item.length);
      return { source, gain };
    });
  }
  async play(project: Project, tracks: Track[], position: number) {
    if (!validProject(project, tracks) || !Number.isFinite(position) || position < 0) throw new Error('This mashup contains invalid edits.');
    this.pause();
    const generation = ++this.generation;
    const context = this.getContext();
    // Decode first, then choose the shared start time. No JS timers drive sound.
    for (const clip of project.clips) {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) throw new Error('A source track is missing.');
      await this.load(track);
    }
    if (generation !== this.generation) return;
    await context.resume();
    this.base = context.currentTime + 0.08; this.offset = position; this.end = duration(project);
    this.nodes = await this.graph(context, project, tracks, position, this.base, () => generation === this.generation);
    this.playing = generation === this.generation;
  }
  position() { return this.playing ? Math.min(this.end, this.offset + Math.max(0, this.getContext().currentTime - this.base) * 1000) : this.offset; }
  pause() {
    this.offset = this.position(); this.playing = false; this.generation++;
    for (const { source, gain } of this.nodes) { try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); }
    this.nodes = [];
  }
  async release() { this.pause(); this.buffers.clear(); if (this.context) { await this.context.close(); this.context = undefined; } }
  async export(project: Project, tracks: Track[]) {
    if (!validProject(project, tracks)) throw new Error('This mashup contains invalid edits.');
    this.pause();
    const ms = duration(project); if (!ms) throw new Error('Add an audio clip first.');
    const context = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(ms * 44.1), sampleRate: 44100 });
    const nodes = await this.graph(context, project, tracks, 0, 0);
    try {
      const buffer = await context.startRendering();
      return encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], buffer.sampleRate);
    } finally { for (const { source, gain } of nodes) { source.disconnect(); gain.disconnect(); } }
  }
}
export const mashup = new MashupEngine();
