import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { uid } from './model';
import { MAX_AUDIO_BYTES, ownedAudio } from './security';

export async function pickAudio() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
  return result.canceled ? [] : result.assets;
}
export async function keepAudio(asset: DocumentPicker.DocumentPickerAsset) {
  const source = new File(asset.uri);
  if ((asset.size ?? 0) > MAX_AUDIO_BYTES || source.size > MAX_AUDIO_BYTES) throw new Error('Choose an audio file smaller than 40 MB.');
  const dir = new Directory(Paths.document, 'audio');
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${uid()}.${asset.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'audio'}`);
  source.copy(target);
  if (target.size > MAX_AUDIO_BYTES) { target.delete(); throw new Error('Choose an audio file smaller than 40 MB.'); }
  return target.uri;
}
export async function removeFile(uri: string) {
  if (!ownedAudio(uri, new Directory(Paths.document, 'audio').uri)) throw new Error('Only VibeCut imported audio can be removed.');
  const file = new File(uri); if (file.exists) file.delete();
}
export async function writeExport(data: Uint8Array, name: string) {
  const file = new File(Paths.cache, `${name.replace(/[^\w-]/g, '_')}-${Date.now()}.wav`);
  file.create(); file.write(data);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'audio/wav', UTI: 'com.microsoft.waveform-audio' });
  else throw new Error(`Export saved to ${file.uri}. Sharing is unavailable on this device.`);
  return file.uri;
}
