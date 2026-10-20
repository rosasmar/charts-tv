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

The wrapper's `console.info` lines show up as `KeplerScript-JavaScript`. The web page's own console doesn't show up here.

`assets/keytest.html` counts every key press and Media Session action, and shows them on screen. To use it, point `APP_URL` at `file:///pkg/assets/keytest.html`.

## What we've confirmed on the VVD

- D-pad presses reach the page as `keydown` events: keyCode 37–40 for the arrows and 13 for Enter. Pressing the same key repeatedly is reported every time.
- Play/Pause reaches the WebView. `KEY_NEXTSONG` is rejected with "Unknown key code string".
- The WebView loads HTTPS URLs with no manifest changes.
