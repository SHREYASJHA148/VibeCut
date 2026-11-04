import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClip, splitClip, snap, schedule, envelope, gainAt, duration } from '../src/model.ts';
import { encodeWav } from '../src/wav.ts';
import { analyzeSamples } from '../src/analysis.ts';

const clip = { id: 'a', trackId: 'song', lane: 0, start: 1000, in: 500, out: 4500, volume: .8, muted: false, fadeIn: 1000, fadeOut: 1000 };
const project = { id: 'p', name: 'Mix', bpm: 120, updated: 0, clips: [clip] };
test('clamp trim, timeline and fades to valid source and project bounds', () => {
  const c = normalizeClip({ ...clip, start: -500, in: -1, out: 9000, volume: 2, fadeIn: 6000 }, 5000);
  assert.deepEqual([c.in, c.out, c.start, c.volume, c.fadeIn, c.fadeOut], [0, 5000, 0, 1, 5000, 0]);
  const right = normalizeClip({ ...clip, start: 299999 }, 5000);
  assert.equal(right.start + right.out - right.in, 300000);
});
test('snap to project beat grid and preserve unsnapped positions', () => {
  assert.equal(snap(710, 120, true), 500); assert.equal(snap(710, 120, false), 710);
  assert.equal(snap(1490, 60, true), 1000);
});
test('seek schedule accounts for source trim and elapsed timeline', () => {
  assert.equal(duration(project), 5000);
  let [s] = schedule(project, 0); assert.deepEqual([s.when, s.offset, s.length], [1, .5, 4]);
  [s] = schedule(project, 2500); assert.deepEqual([s.when, s.offset, s.length, s.elapsed], [0, 2, 2.5, 1.5]);
  assert.equal(schedule(project, 5000).length, 0);
  assert.equal(schedule({ ...project, clips: [{ ...clip, muted: true }] }, 0).length, 0);
});
test('split preserves source duration, timeline continuity and lane', () => {
  const [left, right] = splitClip(clip, 3000);
  assert.equal(left.out, right.in); assert.equal(left.start + left.out - left.in, right.start);
  assert.equal(left.out - left.in + right.out - right.in, clip.out - clip.in);
  assert.equal(right.lane, left.lane); assert.notEqual(right.id, left.id);
  assert.equal(splitClip(clip, 1000), undefined); assert.equal(splitClip(clip, 4999), undefined);
});
test('envelope resumes partway through fades and reaches silence', () => {
  const points = envelope(clip);
  assert.equal(gainAt(points, 0), 0); assert.equal(gainAt(points, .5), .4);
  assert.equal(gainAt(points, 2), .8); assert.ok(Math.abs(gainAt(points, 3.5) - .4) < 1e-9);
  assert.equal(gainAt(points, 4), 0);
  assert.equal(gainAt(envelope({ ...clip, muted: true }), 2), 0);
});
test('stereo WAV has valid headers, interleaving and clipped PCM samples', () => {
  const data = encodeWav([new Float32Array([-2, 0, 2]), new Float32Array([.5, -.5, 0])], 44100);
  const v = new DataView(data.buffer); const text = (i, n) => String.fromCharCode(...data.slice(i, i + n));
  assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 4), 'WAVE');
  assert.equal(v.getUint32(4, true), data.length - 8); assert.equal(v.getUint32(40, true), 12);
  assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getInt16(44, true), -32768); assert.equal(v.getInt16(46, true), 16384);
  assert.equal(v.getInt16(52, true), 32767);
});
test('waveform is measured from source samples, silence has no invented tempo', () => {
  const silence = analyzeSamples([new Float32Array(44100)], 44100);
  assert.equal(silence.bpm, undefined); assert.equal(Math.max(...silence.peaks), 0);
  const audio = new Float32Array(44100 * 12);
  for (let beat = 0; beat < 24; beat++) for (let i = 0; i < 400; i++) audio[beat * 22050 + i] = .8;
  const result = analyzeSamples([audio], 44100);
  assert.ok(result.peaks.some(p => p > .7)); assert.equal(result.bpm, 120);
});
