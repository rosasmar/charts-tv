# Friction log

This file records the snags we hit while building TickerTV with the Amazon Vega SDK, for the hackathon's friction-log bonus. Add new entries as they happen, with the date, what happened, the impact, and a suggested fix.

Environment: MacBook Pro M1, macOS Sonoma 14.6.1, Node 24, Homebrew 7.0.9, Vega SDK 0.24.12112, Vega CLI 1.4.5.

## Vega SDK install

| # | When | What happened | Impact | Suggestion |
|---|------|---------------|--------|------------|
| 1 | Oct 19 | The install docs don't say how much disk space the SDK and Vega Virtual Device (VVD) need. We planned for about 20 GB. The actual install (CLI, SDK 0.24.12112 and VVD) came to 5.4 GB. | We only found out at install time that the machine had too little free space, and spent time freeing far more than we needed. | List the free disk space needed in the prerequisites, and have `get_vvm.sh` check it before downloading. |
| 2 | Oct 20 | The prerequisite step `brew install … watchman` compiled `cmake`, `folly` and other dependencies from source on macOS 14, because no prebuilt packages were available. | Setup took much longer than the "10–15 minutes" in the docs. | Name the supported macOS versions, or ship prebuilt dependencies. |
| 3 | Oct 20 | The install script is served from `sdk-installer.vega.labcollab.net`, not an `amazon.com` domain. | We stopped to check that the domain was legitimate before piping it to bash. | Host the installer on an amazon.com domain, or publish a checksum. |
| 4 | Oct 20 | The current install page doesn't document `NONINTERACTIVE=true`. We found it by reading the script; the 0.21 CI docs also mention it. | Running the installer from an automated or agent-driven terminal took extra effort. | Document it on the main install page. |

## Project setup and tooling

| # | When | What happened | Impact | Suggestion |
|---|------|---------------|--------|------------|
| 5 | Oct 20 | `vega project generate -t vegaWebview -n tickertvHello` wrote the template files straight into the current directory instead of a `tickertvHello/` folder, even though `--name` was given. | The working folder filled up with stray files, which we moved by hand. | Create a `<name>/` subfolder by default, like most scaffolders do. |
| 6 | Oct 20 | It wasn't obvious how to read an app's console output from the VVD. `loggingctl log` printed nothing we could match. `vega device start-log-stream` works, but we only found it in `vega device --help`. Even then, `console.*` calls from the web page itself don't appear, only the React Native wrapper's. | It took several tries to confirm the WebView had loaded. Debugging the web app still means looking at the screen. | Mention `start-log-stream` in the WebView guide, add a per-app filter, and forward WebView console messages to the log. |
| 7 | Oct 20 | Automating the VVD is hard to discover. `inputd-cli button_press` needs `KEY_RIGHT`-style names, and `dpad_right`, `right` and `DPAD_RIGHT` all fail without listing the valid ones. `screenshooter` fails with "creating a buffer file … Permission denied". One badly quoted shell command took down `com.amazon.dev.shell.service` for about 10 seconds. | Headless testing took longer than it should have. | Add `vega device press-key` and `vega device screenshot` commands, and have `inputd-cli` print the valid key names. |
| 8 | Oct 20 | Injecting `KEY_NEXTSONG` reaches the app but logs `Volta:dispatchKeyEvent : Unknown key code string: NEXTSONG`. `KEY_PLAYPAUSE` works. | It's unclear which media keys a WebView app can rely on for Alexa "next" and "previous". | Document which remote and media keys reach a WebView, and how they map to DOM `keydown` events and Media Session actions. |
