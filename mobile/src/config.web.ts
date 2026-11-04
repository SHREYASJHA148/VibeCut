// Browser preview keeps the bearer token in memory; native builds use SecureStore.
import { accessToken, serverUrl } from './security';
let token = '';
export async function getConfig() { return { url: serverUrl(localStorage.getItem('vibecut.server') ?? process.env.EXPO_PUBLIC_API_URL ?? ''), token }; }
export async function saveConfig(url: string, nextToken: string) {
  const value = serverUrl(url), next = accessToken(nextToken);
  localStorage.setItem('vibecut.server', value); token = next;
}
