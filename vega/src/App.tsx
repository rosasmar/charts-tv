import {WebView} from '@amazon-devices/webview';
import * as React from 'react';
import {useRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  useHideSplashScreenCallback,
  usePreventHideSplashScreen,
} from '@amazon-devices/react-native-kepler';
import {
  SslErrorData,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigationEvent,
} from '@amazon-devices/webview/dist/types/WebViewTypes';

// The production deployment of web/ on Vercel. Append URL flags such as
// ?demo=1 or ?news=amazon for recordings (see the main README).
// For D-pad debugging, use 'file:///pkg/assets/keytest.html' instead.
const APP_URL = 'https://chartstv.vercel.app';

// The page's own console output doesn't reach the device log, so forward it
// (and uncaught errors) to this wrapper, which logs it with a [web] prefix.
// Read it with `vega device start-log-stream`.
const FORWARD_CONSOLE = `(function () {
  var bridge = window.ReactNativeWebView;
  if (!bridge) return;
  function send(level, args) {
    try {
      bridge.postMessage(JSON.stringify({
        type: 'console',
        level: level,
        text: Array.prototype.map.call(args, function (a) {
          try { return typeof a === 'string' ? a : JSON.stringify(a); }
          catch (e) { return String(a); }
        }).join(' '),
      }));
    } catch (e) {}
  }
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      send(level, arguments);
      return original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    send('error', ['Uncaught ' + e.message + ' at ' + e.filename + ':' + e.lineno]);
  });
})();
true;`;

function logWebMessage({nativeEvent: {data}}: WebViewMessageEvent) {
  try {
    const message = JSON.parse(data);
    if (message.type === 'console') {
      const log = message.level === 'error' ? console.error : console.info;
      log(`[web] ${message.level}: ${message.text}`);
      return;
    }
  } catch {
    // Not one of ours; fall through and log it raw.
  }
  console.info(`[web] message: ${data}`);
}

export const App = () => {
  const webRef = useRef(null);
  // By default splash screen is shown in app launch, as the splash
  // screen images are bundled in this app (assets/raw/ folder)
  // Declare that application wants to extend splash screen lifecycle
  usePreventHideSplashScreen();
  const hideSplashScreenCallback = useHideSplashScreenCallback();
  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        allowSystemKeyEvents
        allowsDefaultMediaControl
        domStorageEnabled
        hasTVPreferredFocus
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={FORWARD_CONSOLE}
        onMessage={logWebMessage}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        // thirdPartyCookiesEnabled
        // userAgent={''}
        source={{
          // headers: {},
          uri: APP_URL,
        }}
        onLoad={(_event: WebViewNavigationEvent) => {
          console.info('Page loading completed...');
          // Hide the splash screen
          hideSplashScreenCallback();
        }}
        onLoadStart={(_event: WebViewNavigationEvent) => {
          console.info('Page loading started...');
        }}
        onError={({
          nativeEvent: {code, url, description},
        }: WebViewErrorEvent) => {
          console.error(`[onError]: (${code}: ${url}) ${description}`);
        }}
        onHttpError={({
          nativeEvent: {url, statusCode: code, description, isMainFrame},
        }: WebViewHttpErrorEvent) => {
          console.error(`[onHttpError]: (${code}: ${url}) ${description}`);
          console.error(`[onHttpError]: isMainFrame: ${isMainFrame}`);
        }}
        onSslError={({code, url, description}: SslErrorData) => {
          console.error(`[onSslError]: (${code}: ${url}) ${description}`);
        }}
      />
    </View>
  );
};

// Styles for layout, which are necessary for proper focus behavior
const styles = StyleSheet.create({
  container: {flex: 1},
  webview: {backgroundColor: '#000000'},
});
