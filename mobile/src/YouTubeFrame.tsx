import React, { useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import app from '../app.json';
import { youtubeHtml, youtubeNavigation } from './youtube';
import { httpsUrl } from './security';

export type YouTubeFrameProps = { id: string; onReady: () => void; onError: (code: number) => void };
export function YouTubeFrame({ id, onReady, onError }: YouTubeFrameProps) {
  const appId = Platform.OS === 'ios' ? app.expo.ios.bundleIdentifier : app.expo.android.package;
  const origin = `https://${appId.toLowerCase()}`;
  const source = useMemo(() => ({ html: youtubeHtml(id, origin), baseUrl: origin }), [id, origin]);
  return <WebView accessibilityLabel="YouTube video player" source={source} originWhitelist={['*']}
    javaScriptEnabled allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction
    allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
    mixedContentMode="never" javaScriptCanOpenWindowsAutomatically={false}
    onShouldStartLoadWithRequest={request => youtubeNavigation(request.url, origin, request.isTopFrame === false)}
    onOpenWindow={event => { const url = httpsUrl(event.nativeEvent.targetUrl); if (url) void Linking.openURL(url).catch(() => onError(5)); }}
    allowsPictureInPictureMediaPlayback={false} style={{ flex: 1, backgroundColor: '#000' }}
    onMessage={event => { try {
      if (event.nativeEvent.data.length > 2048) return;
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') onReady();
      else if (message.type === 'error' && Number.isFinite(message.code)) onError(message.code);
    } catch {} }} onError={() => onError(5)} onHttpError={() => onError(5)} />;
}
