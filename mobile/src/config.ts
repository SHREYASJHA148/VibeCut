import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { accessToken, serverUrl } from './security';
export async function getConfig() {
  return { url: serverUrl(await AsyncStorage.getItem('vibecut.server') ?? process.env.EXPO_PUBLIC_API_URL ?? ''), token: accessToken(await SecureStore.getItemAsync('vibecut-token') ?? '') };
}
export async function saveConfig(url: string, token: string) {
  const trimmed = serverUrl(url);
  await SecureStore.setItemAsync('vibecut-token', accessToken(token), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await AsyncStorage.setItem('vibecut.server', trimmed);
}
