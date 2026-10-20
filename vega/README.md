# vega/

A Vega WebView wrapper that runs the `web/` app on Fire TV and the Vega Virtual Device (VVD). It is generated from the SDK's `vegaWebview` template.

The URL the WebView loads is `APP_URL` in `src/App.tsx`.

## Setup (once)

1. Install the Vega SDK and its prerequisites by following the [install guide](https://developer.amazon.com/docs/vega/0.23/install-vega-sdk.html).
2. Load the SDK environment into your shell:
   ```sh
   source ~/vega/env
   ```
3. Check the install:
   ```sh
   vega --version
   ```
   We tested with SDK 0.24.12112.

## Run on the VVD

```sh
vega virtual-device start            # boots in about 25 seconds
npm install
npm run build:debug
vega run-app build/aarch64-debug/tickertv_aarch64.vpkg com.chartstv.tickertv.main -d VirtualDevice
```

If you're on an Intel Mac, use the `x86_64` build instead.

## Debugging without looking at the screen

Press remote buttons (key names are `KEY_*`):

```sh
vega exec vda shell "inputd-cli button_press KEY_RIGHT"
```

Other keys: `KEY_LEFT`, `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_PLAYPAUSE`.

Stream the device logs:

```sh
vega device start-log-stream
```

The wrapper forwards the web page's console output and uncaught errors into this log with a `[web]` prefix. It works by injecting a small script with `injectedJavaScriptBeforeContentLoaded` and `postMessage`. To see only those lines:

```sh
vega device start-log-stream | grep -F "[web]"
```

`assets/keytest.html` counts every key press and Media Session action, and shows them on screen. To use it, point `APP_URL` at `file:///pkg/assets/keytest.html`.

## What we've confirmed on the VVD

Remote buttons reach the page as `keydown` events, not as `mediaSession` actions:

| Remote button (`inputd-cli` name) | `event.key` | `keyCode` |
|---|---|---|
| Arrows (`KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`) | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` | 38, 40, 37, 39 |
| OK (`KEY_ENTER`) | `Enter` | 13 |
| Play/Pause (`KEY_PLAYPAUSE`, `KEY_PLAY`, `KEY_PAUSE`) | `MediaPlayPause` | 179 |
| Fast-forward (`KEY_FASTFORWARD`) | `MediaFastForward` | 228 |
| Rewind (`KEY_REWIND`) | `MediaRewind` | 227 |
| Back (`KEY_BACK`) | `GoBack` | 27 |
| Next/Previous (`KEY_NEXTSONG`, `KEY_PREVIOUSSONG`) | not delivered | |

Pressing the same key repeatedly is reported every time. Alexa voice commands are meant to reach `navigator.mediaSession` handlers instead, because `allowsDefaultMediaControl` is set. We haven't verified that on the VVD.
- The WebView loads HTTPS URLs with no manifest changes.
