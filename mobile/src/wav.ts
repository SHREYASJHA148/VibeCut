export function encodeWav(channels: Float32Array[], sampleRate: number) {
  const count = channels.length, length = channels[0].length;
  const bytes = new Uint8Array(44 + length * count * 2), view = new DataView(bytes.buffer);
  const word = (offset: number, text: string) => [...text].forEach((v, i) => view.setUint8(offset + i, v.charCodeAt(0)));
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < length; i++) for (let ch = 0; ch < count; ch++) {
    const value = Math.max(-1, Math.min(1, channels[ch][i]));
    view.setInt16(44 + (i * count + ch) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
