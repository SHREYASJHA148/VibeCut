import { Directory, Paths } from 'expo-file-system';
import { isAudiusStream, ownedAudio } from './security';
export async function resolveUri(uri: string) {
  if (!isAudiusStream(uri) && !ownedAudio(uri, new Directory(Paths.document, 'audio').uri)) throw new Error('This audio reference is invalid.');
  return uri;
}
