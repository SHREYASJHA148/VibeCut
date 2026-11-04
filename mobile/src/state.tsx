import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyLibrary, Library } from './model';
import { validateLibrary } from './libraryValidation';

const KEY = 'vibecut.library.v1';
type State = { data: Library; update: (fn: (data: Library) => Library) => void; ready: boolean; error: string; clearError: () => void };
const Context = createContext<State>(null!);
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(emptyLibrary), [ready, setReady] = useState(false), [error, setError] = useState('');
  const pending = useRef<Library | null>(null), saving = useRef(false);
  const writable = useRef(true);
  useEffect(() => { AsyncStorage.getItem(KEY).then(raw => {
    if (raw) {
      if (raw.length > 16 * 1024 * 1024) throw new Error('Library exceeds its storage limit');
      setData(validateLibrary(JSON.parse(raw)));
    }
  }).catch(() => { writable.current = false; setError('Your saved library could not be read. Restart the app to retry; existing data has been preserved.'); }).finally(() => setReady(true)); }, []);
  const persist = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    try { while (pending.current) { const next = pending.current; pending.current = null; await AsyncStorage.setItem(KEY, JSON.stringify(next)); } }
    catch { setError('Changes could not be saved. Check available device storage.'); }
    finally { saving.current = false; }
  }, []);
  useEffect(() => { if (ready && writable.current) { pending.current = data; void persist(); } }, [data, ready, persist]);
  const update = useCallback((fn: (data: Library) => Library) => {
    if (!writable.current) { setError('Restart the app before making changes to the library.'); return; }
    setData(fn);
  }, []);
  return <Context.Provider value={{ data, update, ready, error, clearError: () => setError('') }}>{children}</Context.Provider>;
}
export const useLibrary = () => useContext(Context);
