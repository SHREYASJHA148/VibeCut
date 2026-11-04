import * as DocumentPicker from 'expo-document-picker';
import { uid } from './model';
import { MAX_AUDIO_BYTES, isAudiusStream } from './security';
const db = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('vibecut-audio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('files');
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
async function transaction(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest) {
  const database = await db();
  try { return await new Promise<any>((resolve, reject) => {
    const tx = database.transaction('files', mode); const request = run(tx.objectStore('files'));
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { database.close(); }
}
export async function pickAudio() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true });
  return result.canceled ? [] : result.assets;
}
export async function keepAudio(asset: DocumentPicker.DocumentPickerAsset) {
  if ((asset.size ?? 0) > MAX_AUDIO_BYTES) throw new Error('Choose an audio file smaller than 40 MB.');
  const id = `idb:${uid()}`;
  const blob = asset.file ?? await (await fetch(asset.uri)).blob();
  if (blob.size > MAX_AUDIO_BYTES) throw new Error('Choose an audio file smaller than 40 MB.');
  await transaction('readwrite', store => store.put(blob, id)); return id;
}
const urls = new Map<string, string>();
export async function resolveUri(uri: string) {
  if (isAudiusStream(uri)) return uri;
  if (!/^idb:[a-z0-9-]+$/i.test(uri)) throw new Error('This audio reference is invalid.');
  if (urls.has(uri)) return urls.get(uri)!;
  const blob = await transaction('readonly', store => store.get(uri));
  if (!blob) throw new Error('This audio file is missing. Import it again.');
  const url = URL.createObjectURL(blob); urls.set(uri, url); return url;
}
export async function removeFile(uri: string) {
  if (!/^idb:[a-z0-9-]+$/i.test(uri)) throw new Error('Only imported audio can be removed.');
  if (urls.has(uri)) URL.revokeObjectURL(urls.get(uri)!); urls.delete(uri);
  await transaction('readwrite', store => store.delete(uri));
}
export async function writeExport(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'audio/wav' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name}.wav`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); return url;
}
