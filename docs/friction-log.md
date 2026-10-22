# Friction log

These are the snags we hit while building ChartsTV with the Amazon Vega SDK, the Vega Virtual Device (VVD) and Amazon Bedrock. Each entry follows the hackathon's format: task, steps, expected vs actual, severity, workaround and suggestion. [`feedback.md`](feedback.md) refers to entries by number.

**Environment:** MacBook Pro M1, macOS Sonoma 14.6.1, Node 24, Homebrew 7.0.9, Vega SDK 0.24.12112, Vega CLI 1.4.5, AWS CLI 2.38, Oct 19–21, 2026.

**Severity scale:**
- **Critical:** blocked a core feature, with no workaround.
- **High:** cost hours, or needed a custom workaround.
- **Medium:** cost time, with an easy workaround.
- **Low:** annoyance.

## Summary

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | SDK install | Disk space needed isn't documented | Medium |
| 2 | SDK install | macOS 14 prerequisites build from source | Low |
| 3 | SDK install | Installer served from a non-Amazon domain | Low |
| 4 | SDK install | `NONINTERACTIVE` install mode undocumented | Low |
| 5 | Tooling | `vega project generate` ignores `--name` for the output folder | Low |
| 6 | Tooling | Web page console output never reaches the device log | High |
| 7 | Tooling | VVD key injection and screenshots are hard to discover | Medium |
| 8 | Remote | `KEY_NEXTSONG` rejected as an unknown key | Medium |
| 9 | Remote | Media buttons arrive as `keydown`, not Media Session; Next/Previous never arrive | High |
| 10 | Voice | No way to simulate an Alexa voice command on the VVD | Medium |
| 11 | Tooling | First seconds of app logs missing from the log stream | Low |
| 12 | Always-on | No way to keep a non-video app awake (screensaver after 5 min) | **Critical** |
| 13 | Always-on | VVD has no screensaver app, so idle behavior is invisible | Medium |
| 14 | Bedrock | Free plan: one region, no bedrock-mantle endpoint | High |
| 15 | Bedrock | Paid new account: all Claude models denied, use-case form "not authorized" | **Critical** |
| 16 | Bedrock | All daily token quotas are 0, so even Nova is throttled | High |
| 17 | Bedrock | Opus 5.5 listed ACTIVE but returns 404; neighboring models return 403 | Medium |
| 18 | AWS CLI | Positive: `aws login` + SDK credential pickup | n/a |
| 19 | Kiro CLI | Installer fails with "Operation not permitted" and leaves a half-installed app | Medium |
| 20 | Kiro Crew | Agent-written feature passed its tests but failed at runtime against real Redis | Medium |
| 21 | Kiro Crew | Crew leaves local settings folders in the repo root | Low |

---

## Vega SDK install

### 1. Disk space needed isn't documented (Medium)
- **Task:** Install the Vega SDK and the VVD.
- **Steps:** Followed the 0.23 install page, then ran `get_vvm.sh`.
- **Expected:** The prerequisites list the free disk space needed, and the installer checks it before downloading.
- **Actual:** Neither the docs nor the installer mention disk space. We planned for about 20 GB; the real install (CLI, SDK 0.24.12112 and VVD) used 5.4 GB.
- **Workaround:** Freed space by deleting files, thinning Time Machine local snapshots, and installing a pending macOS update to release its snapshots. That was far more than needed.
- **Suggestion:** List the required free space in the prerequisites, and have `get_vvm.sh` check it first.

### 2. macOS 14 prerequisites build from source (Low)
- **Task:** Install the documented Homebrew prerequisites.
- **Steps:** Ran `brew install binutils coreutils gawk findutils grep jq lz4 gnu-sed watchman` on macOS 14.6.
- **Expected:** A setup of about 10–15 minutes, as the docs say.
- **Actual:** No prebuilt packages were available, so Homebrew compiled `cmake`, `folly` and others from source, which took much longer.
- **Workaround:** Ran the Vega installer in parallel; it only needs `curl` and `tar`.
- **Suggestion:** Name the supported macOS versions, or ship prebuilt dependencies.

### 3. Installer served from a non-Amazon domain (Low)
- **Task:** Run the install command from the docs.
- **Steps:** `curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash`
- **Expected:** An `amazon.com` domain, or a published checksum.
- **Actual:** The script comes from `labcollab.net`.
- **Workaround:** Downloaded the script and read it before running, and confirmed the URL on the official docs page.
- **Suggestion:** Host it on an amazon.com domain, or publish a checksum.

### 4. `NONINTERACTIVE` install mode undocumented (Low)
- **Task:** Run the installer from an automated, agent-driven terminal.
- **Steps:** Read the current install page.
- **Expected:** A documented non-interactive mode.
- **Actual:** It's only mentioned in the 0.21 CI docs; we found `NONINTERACTIVE=true` by reading the script.
- **Workaround:** `NONINTERACTIVE=true` worked, using the default paths.
- **Suggestion:** Document it on the main install page.

## Project setup and tooling

### 5. `vega project generate` ignores `--name` for the output folder (Low)
- **Task:** Create a WebView app from the template.
- **Steps:** `vega project generate -t vegaWebview -n tickertvHello`
- **Expected:** A new `tickertvHello/` folder.
- **Actual:** The template files were written straight into the current directory.
- **Workaround:** Moved the files into a subfolder by hand. `--outputDir` also works.
- **Suggestion:** Create a `<name>/` subfolder by default, like most scaffolders.

### 6. Web page console output never reaches the device log (High)
- **Task:** Confirm the WebView loaded, and debug the web app on the VVD.
- **Steps:** Tried `loggingctl log` and grepping the journal, found `vega device start-log-stream` in `vega device --help`, and logged from the page.
- **Expected:** The page's `console.*` output appears in the device log, as the React Native wrapper's output does.
- **Actual:** Only the wrapper's logs appear. The page's own console output is invisible, so debugging means watching the screen.
- **Workaround:** We built a bridge (PR #9). It injects a script with `injectedJavaScriptBeforeContentLoaded` that forwards `console.*` and uncaught errors over `postMessage`, and the wrapper logs them with a `[web]` prefix.
- **Suggestion:** Forward WebView console output to the device log by default, mention `start-log-stream` in the WebView guide, and add a per-app filter.

### 7. VVD key injection and screenshots are hard to discover (Medium)
- **Task:** Test remote input without a human at the keyboard.
- **Steps:**
  - `inputd-cli button_press dpad_right`, then `right`, then `DPAD_RIGHT`.
  - `screenshooter /tmp/x.png`.
- **Expected:** Documented key names, and a working screenshot command.
- **Actual:**
  - All three key names fail with "invalid button value", and the valid names aren't listed. `KEY_RIGHT` works.
  - `screenshooter` fails with "creating a buffer file … Permission denied".
  - One badly quoted shell command took down `com.amazon.dev.shell.service` for about 10 seconds.
- **Workaround:** Found `KEY_*` names by trial. Verified behavior through the log bridge (#6), with a human checking the screen.
- **Suggestion:** Add `vega device press-key` and `vega device screenshot`, and have `inputd-cli` list valid key names.

## Remote, voice and always-on behavior

### 8. `KEY_NEXTSONG` rejected as an unknown key (Medium)
- **Task:** Support Alexa or remote "next" and "previous" in the WebView.
- **Steps:** Injected `KEY_NEXTSONG` with `inputd-cli`.
- **Expected:** A next-track key event or Media Session action reaches the page.
- **Actual:** The app logs `Volta:dispatchKeyEvent : Unknown key code string: NEXTSONG`, and nothing reaches the page. `KEY_PLAYPAUSE` works.
- **Workaround:** Used fast-forward and rewind for next and previous coin (#9).
- **Suggestion:** Document which remote and media keys reach a WebView, and deliver Next/Previous track.

### 9. Media buttons arrive as `keydown`, not Media Session (High)
- **Task:** Handle the remote's media buttons and Alexa transport commands.
- **Steps:** With `allowsDefaultMediaControl` set, registered `navigator.mediaSession` handlers and a `keydown` logger on a test page, then injected `KEY_PLAYPAUSE`, `KEY_FASTFORWARD`, `KEY_REWIND`, `KEY_NEXTSONG` and `KEY_PREVIOUSSONG`.
- **Expected:** Following the WebView guide, media commands reach the page's Media Session handlers.
- **Actual:**
  - The remote buttons arrive as plain `keydown` events: `MediaPlayPause` (179), `MediaFastForward` (228) and `MediaRewind` (227).
  - No Media Session handler fired.
  - Next and Previous never arrive at all.
- **Workaround:** Handled both paths (PR #14): `keydown` media keys for the remote, and Media Session handlers for Alexa voice.
- **Suggestion:** Document which buttons arrive as `keydown` and which as Media Session actions.

### 10. No way to simulate an Alexa voice command on the VVD (Medium)
- **Task:** Test "Alexa, pause" and "Alexa, fast forward" against the app.
- **Steps:** Looked for tooling on the device and in the docs; found `alexa`.
- **Expected:** A way to send a voice or media-control intent to the foreground app.
- **Actual:** The `alexa` tool only simulates the mic button and needs real speech. Nothing in the docs covers injecting voice intents.
- **Workaround:** Implemented the documented Media Session path, marked it untested, and demo with the remote buttons only.
- **Suggestion:** Add `vega device send-media-command pause|play|seekforward|…`.

### 11. First seconds of app logs missing from the log stream (Low)
- **Task:** See the wrapper's startup logs, such as "Page loading completed".
- **Steps:** Started `vega device start-log-stream`, then launched the app.
- **Expected:** All app logs from process start.
- **Actual:** Lines from the first few seconds after launch are often missing.
- **Workaround:** Repeat important status lines about 20 s after start, and terminate and relaunch the app after starting the stream.
- **Suggestion:** Replay app logs from process start, or add `--since-launch`.

### 12. No way to keep a non-video app awake (Critical)
- **Task:** Keep an always-on market dashboard on screen all day.
- **Steps:** Left the app in the foreground with no input and watched the device log, then tried three fixes:
  1. The W3C Screen Wake Lock API, `navigator.wakeLock.request('screen')`.
  2. A muted, looping `<video>`.
  3. A native Turbo Module calling `IKeplerUserEngagementModuleV2::makeVideoPlaybackUserEngagement()->start()`.
- **Expected:** A supported way for an app to keep the screen on, like Android's `FLAG_KEEP_SCREEN_ON`.
- **Actual:**
  - `lcm-idle-handler: Handling idle event - starting screensaver` fires exactly 5 minutes after the last key press.
  - Wake Lock rejects with `NotAllowedError`.
  - The video froze at 3.1 s on the VVD and never created a decode session.
  - The User Engagement `start()` returns success, but idle still fires. The resource manager logs `display decoded session status … not engaged ? true`, which suggests engagement is tracked per video decode session.
- **Workaround:** None. It's documented as a known limitation, and the native module is kept on the `vega-keep-awake` branch.
- **Suggestion:** Add a documented keep-screen-on capability for apps. Ideally allow Wake Lock in WebView apps, or add a WebView prop such as `keepScreenOn`, and document what User Engagement needs to take effect.

### 13. VVD has no screensaver app, so idle behavior is invisible (Medium)
- **Task:** Check whether the screensaver interrupts the app.
- **Steps:** Left the app idle on the VVD and watched the screen and the log.
- **Expected:** The VVD shows the screensaver, as a real Fire TV would.
- **Actual:** The idle handler tries to launch `os://ambient-component`, which isn't installed (`Package for id 'ambient-component' not found`), so nothing visible happens.
- **Workaround:** Found the idle event by reading the device log.
- **Suggestion:** Ship a placeholder screensaver on the VVD, or log a clear warning.

## Amazon Bedrock on a new AWS account

### 14. Free plan: one region, no bedrock-mantle endpoint (High)
- **Task:** Call Claude on Bedrock from a new AWS account (free plan, $100 credits).
- **Steps:** Opened the Bedrock console in us-east-1, then the new console for the bedrock-mantle endpoint.
- **Expected:** The current Claude endpoint is available, as the sign-up credits suggest.
- **Actual:**
  - us-east-1 shows "Region unavailable… upgrade your plan", because the account is pinned to eu-north-1.
  - The bedrock-mantle endpoint shows "Upgrade to paid plan to access this service".
- **Workaround:** Used eu-north-1, then upgraded to the paid plan.
- **Suggestion:** Say on the free-plan sign-up page which Bedrock endpoints and models are included.

### 15. Paid new account: all Claude models denied, use-case form "not authorized" (Critical)
- **Task:** Get access to any Claude model on Bedrock after upgrading.
- **Steps:**
  - Tried Opus 5.5, Sonnet 5, Haiku 4.5 and Opus 4.8 in the playground and the SDK, in eu-north-1, us-east-1 and us-west-2.
  - Submitted the Anthropic use-case form in the console, then with `aws bedrock put-use-case-for-model-access`.
- **Expected:** After the one-time use-case form, Claude models are available.
- **Actual:**
  - Every model returns `403 … is not available for this account`.
  - The form fails in both places with `ValidationException: Your account is not authorized to perform this action. Please create a support case`.
  - `get-foundation-model-availability` reports `authorizationStatus: NOT_AUTHORIZED`.
- **Workaround:** Opened a support case. Support replied: *"Please resubmit once your account has built successful spend and usage history"*, and said that these are the terms for a paid service. No timeline was given, which rules out using this account during a 5-day hackathon. The app falls back to a price summary, and we're pursuing a teammate's older AWS account.
- **Suggestion:** Say in the Bedrock console *before* sign-up or upgrade that new accounts need spend and usage history for Anthropic models, roughly how much and how long, and return that reason in the API error instead of "not authorized". For developer events, offer an expedited path.

### 16. All daily token quotas are 0, so even Nova is throttled (High)
- **Task:** Use an Amazon model (no use-case form) as a fallback.
- **Steps:** Sent "hi" to Nova 2 Lite in the playground, then checked `aws service-quotas list-service-quotas --service-code bedrock`.
- **Expected:** A small default quota for a new paid account.
- **Actual:** `ThrottlingException: Too many tokens per day` on the first message. Every Nova "tokens per day" quota is 0.
- **Workaround:** Added it to the support case.
- **Suggestion:** Start new accounts with a small non-zero quota, or return an error that says the quota is 0 and how to raise it.

### 17. Opus 5.5 listed ACTIVE but returns 404 (Medium)
- **Task:** Call `anthropic.claude-opus-5-5` on the Mantle endpoint.
- **Steps:** `aws bedrock list-foundation-models --by-provider anthropic` in eu-north-1, then `messages.create` with the Anthropic Bedrock SDK.
- **Expected:** A model listed ACTIVE behaves like its neighbors, which return 403 for our account.
- **Actual:** `404 The model 'anthropic.claude-opus-5-5' does not exist` in eu-north-1 and us-west-2, while it's 403 in us-east-1. Sonnet 5 also returns 404 in us-west-2.
- **Workaround:** Made the model configurable (`BEDROCK_MODEL`) so we can pick whichever model works once access is granted.
- **Suggestion:** Return a consistent access error, and keep the catalog consistent with what each regional endpoint serves.

### 18. Positive: `aws login` and SDK credential pickup (n/a)
- **Task:** Authenticate the AWS CLI and the app locally without long-lived access keys.
- **Steps:** `aws login --region eu-north-1`, then ran the app.
- **Expected:** We expected to have to create an IAM user and access keys.
- **Actual:** The CLI signed in through the browser console session, and the Anthropic Bedrock SDK picked up the credentials automatically. It took about a minute. The CLI also offers to install AWS skills and an MCP server into coding agents; we declined, to keep access narrow.
- **Note:** The SDK's refresh of `aws login` tokens needs `AWS_REGION` in the environment, or it fails with "Region is missing".
- **Suggestion:** Feature `aws login` in the Bedrock getting-started docs.

## Kiro Crew and Kiro CLI

### 19. Kiro CLI installer fails with "Operation not permitted" (Medium)
- **Task:** Install Kiro CLI, which Kiro Crew requires as its agent.
- **Steps:** Ran `curl -fsSL https://cli.kiro.dev/install | bash` from a terminal on macOS 14.6.
- **Expected:** `Kiro CLI.app` is installed in `/Applications`.
- **Actual:** `ditto: /Applications/Kiro CLI.app/Contents/MacOS/kiro-cli-chat: Operation not permitted`, then "Installation failed. Cleaning up…". The cleanup left a partial app behind (two of the three binaries).
- **Workaround:** Gave the terminal **App Management** permission (System Settings → Privacy & Security), deleted the partial bundle, and reran the installer.
- **Suggestion:** Detect the missing App Management permission and explain how to grant it, or install to `~/Applications`, and make the cleanup actually remove the partial bundle.

### 20. Agent-written feature passed its tests but failed at runtime (Medium)
- **Task:** Have Kiro Crew implement the phone companion from our spec.
- **Steps:** Gave Crew the spec and the repo rules, then ran the task. Crew committed the feature with 104 passing tests and a clean lint and build.
- **Expected:** Working code, or at least code tested against the real Redis client it uses.
- **Actual:**
  - Every unit test mocked or avoided Redis, so a library behavior slipped through: `@upstash/redis` auto-parses JSON on reads, and the code called `JSON.parse` on objects. Every command was dropped, so the TV never reacted.
  - Review also found command IDs taken from the list length, which repeated after trimming and raced between concurrent requests.
  - A single shared `Response` object was reused for every 503.
  - A `useCallback` captured stale state.
- **Workaround:** Code review, fixes with tests (PR #8, commit `746066e`), and verification against real Upstash Redis and a real phone.
- **Suggestion:** Have Crew run an integration check against real services when credentials are available, for example by deploying a preview and hitting the routes. Flag untested external-library behavior in its summary.

### 21. Crew leaves local folders in the repo root (Low)
- **Task:** Keep the repository clean after a Crew run.
- **Steps:** Ran a Crew task on the repo, then checked `git status`.
- **Expected:** Only intended changes, committed on the branch.
- **Actual:** Untracked `.kiro/settings/` (CLI settings and a lock file) and `_bg/.kiro/settings/` appeared in the repo root.
- **Workaround:** Added both to `.gitignore`.
- **Suggestion:** Keep per-run settings outside the working tree, or add them to a repo-local ignore automatically.

## Vega Virtual Device: recording the demo

### 22. VVD clock falls hours behind after the Mac sleeps (High)
- **Task:** Record the demo on the VVD the morning after a recording session.
- **Steps:** Left the VVD running overnight while the Mac slept, relaunched the app, then compared `vega exec vda shell "date"` with the Mac's clock.
- **Expected:** The VVD keeps the host's time, or resyncs when the host wakes.
- **Actual:** The VVD was 10 hours behind (01:45 instead of 11:34 UTC), and on another day 3 hours behind. Our app's night mode, which follows the device clock, dimmed the screen in the middle of the day, and the on-screen clock showed the wrong time.
- **Workaround:** `vega virtual-device stop` and then `start`, after which the clock matched the host.
- **Suggestion:** Resync the VVD clock with the host on wake (or on `run-app`), or add `vega virtual-device sync-time`.

### 23. VVD time zone is fixed to UTC and can't be changed (Medium)
- **Task:** Run the VVD in a local time zone, to test time-of-day features (night dim, auto theme, clock) as a viewer would see them.
- **Steps:**
  - `timedatectl set-timezone America/Los_Angeles` fails with "System has not been booted with systemd as init system".
  - Relinking `/etc/localtime` fails with "Read-only file system", as `app_user`.
  - `timeservice` hung.
  - `vega device --help` lists no time zone or locale option.
- **Expected:** A supported way to set the VVD's time zone, as on a real Fire TV in Settings.
- **Actual:** The VVD always runs in UTC, so every clock-driven feature is shifted by the developer's UTC offset. For us in Zurich, night mode started at midnight local time instead of 22:00.
- **Workaround:** A URL flag in our app (`?dim=off`) and a separate recording build that forces the dim off.
- **Suggestion:** Add `vega virtual-device start --timezone <tz>` or a settings command, and document that the VVD runs in UTC.
