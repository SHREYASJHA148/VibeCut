export function analyzeSamples(channels: Float32Array[], sampleRate: number) {
  const size = channels[0].length, buckets = 600, peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    for (let j = Math.floor(i * size / buckets); j < (i + 1) * size / buckets; j += 8)
      for (const channel of channels) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
    peaks.push(peak);
  }
  // Energy-onset autocorrelation is an estimate; the editor exposes manual BPM.
  const hop = Math.max(1, Math.round(sampleRate / 100)), energy: number[] = [];
  for (let i = 0; i < size; i += hop) {
    let sum = 0;
    for (let j = i; j < Math.min(size, i + hop); j += 4) sum += channels[0][j] ** 2;
    energy.push(sum);
  }
  const onset = energy.map((e, i) => Math.max(0, e - (energy[i - 1] ?? e)));
  let best = 0, bpm: number | undefined;
  for (let candidate = 60; candidate <= 180; candidate++) {
    const lag = Math.round(6000 / candidate); let score = 0;
    for (let i = lag; i < onset.length; i++) score += onset[i] * onset[i - lag];
    score /= Math.max(1, onset.length - lag);
    if (score > best) { best = score; bpm = Math.round(6000 / lag); }
  }
  return { peaks, bpm };
}
