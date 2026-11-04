import React, { useEffect, useRef } from 'react';

type Player = { destroy: () => void };
type API = { Player: new (element: HTMLElement, options: {
  width: string; height: string; videoId: string;
  playerVars: { controls: number; playsinline: number; autoplay: number; origin: string };
  events: { onReady: () => void; onError: (event: { data: number }) => void };
}) => Player };
declare global { interface Window { YT?: API; onYouTubeIframeAPIReady?: () => void } }
let api: Promise<API> | undefined;
function loadApi(): Promise<API> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return api ??= new Promise<API>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); api = undefined; reject(new Error('YouTube player unavailable')); };
    const timer = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); if (window.YT?.Player) resolve(window.YT); else fail(); };
    script.src = 'https://www.youtube.com/iframe_api'; script.onerror = fail; document.head.appendChild(script);
  });
}
export function YouTubeFrame({ id, onReady, onError }: { id: string; onReady: () => void; onError: (code: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false, player: Player | undefined;
    loadApi().then(YT => {
      if (cancelled || !container.current) return;
      const target = document.createElement('div'); container.current.replaceChildren(target);
      player = new YT.Player(target, { width: '100%', height: '100%', videoId: id,
        playerVars: { controls: 1, playsinline: 1, autoplay: 0, origin: window.location.origin },
        events: { onReady: () => { if (!cancelled) onReady(); }, onError: event => { if (!cancelled) onError(event.data); } } });
    }).catch(() => { if (!cancelled) onError(5); });
    return () => { cancelled = true; player?.destroy(); };
  }, [id, onReady, onError]);
  return <div ref={container} aria-label="YouTube video player" style={{ width: '100%', height: '100%', minHeight: 200, background: '#000' }} />;
}
