const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export function youtubeNavigation(value: string, appOrigin: string, subframe = false) {
  if (value === 'about:blank') return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (subframe) return true;
    return url.origin === appOrigin || ['www.youtube.com', 'youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname);
  } catch { return false; }
}
export function youtubeId(input: string): string | undefined {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return;
    const host = url.hostname.toLowerCase();
    let id: string | null | undefined;
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      const parts = url.pathname.split('/');
      id = url.pathname === '/watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[1]) ? parts[2] : undefined;
    }
    return id && VIDEO_ID.test(id) ? id : undefined;
  } catch { return; }
}
export function youtubeError(code: number) {
  if (code === 100) return 'This video is unavailable or private. Try another link.';
  if (code === 101 || code === 150) return 'The uploader has disabled playback in other apps. Try another video or open it on YouTube.';
  if (code === 153) return 'YouTube could not verify this app’s player identity. Try opening the video on YouTube.';
  if (code === 2) return 'This video link is invalid.';
  return 'YouTube could not play this video. Check your connection or try another link.';
}
export function youtubeHtml(id: string, origin: string) {
  if (!VIDEO_ID.test(id) || !/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw new Error('Invalid player configuration.');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;width:100%;height:100%;background:#000}#player{width:100%;height:100%}</style></head><body><div id="player"></div><script>
function send(type,code){window.ReactNativeWebView.postMessage(JSON.stringify({type:type,code:code}));}
function onYouTubeIframeAPIReady(){new YT.Player('player',{width:'100%',height:'100%',videoId:${JSON.stringify(id)},playerVars:{controls:1,playsinline:1,autoplay:0,origin:${JSON.stringify(origin)}},events:{onReady:function(){send('ready');},onError:function(e){send('error',e.data);}}});}
</script><script src="https://www.youtube.com/iframe_api" onerror="send('error',5)"></script></body></html>`;
}
