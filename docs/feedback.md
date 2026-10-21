# Product feedback

This file answers Devpost's product-feedback questions for each Amazon tool, API and SDK we used to build TickerTV. Specific issues, with steps and workarounds, are in [`friction-log.md`](friction-log.md), and the numbers in brackets like [#12] refer to its entries.

## Tools at a glance

| Tool / SDK | What we used it for |
|---|---|
| **Vega SDK + Vega CLI** (0.24.12112 / CLI 1.4.5) | Installing the toolchain, generating, building and running the app (`vega project generate`, `vega build`, `vega run-app`), and device tooling (`vega device …`) |
| **Vega Virtual Device (VVD)** | Running and testing the app, and headless testing with `inputd-cli` key injection and the log stream |
| **Vega WebView** (`@amazon-devices/webview`, React Native for Vega) | Wrapping our Next.js web app as a Vega app, plus remote keys, Media Session and the console bridge |
| **Kepler/Vega Turbo Modules** (IDL template, `com.amazon.kepler.user_engagement`) | An experiment to keep the screen awake (kept on a branch) |
| **Amazon Bedrock** (Claude via `AnthropicBedrockMantle`) | The "What's moving" market summary |
| **AWS CLI** (`aws login`, `bedrock`, `service-quotas`) | Account and model-access diagnostics and authentication |
| **Kiro Crew + Kiro CLI** (CLI 2.33) | Implementing the phone companion from our spec |

## AWS services used (AWS Builder mini-challenge)

- **Kiro Crew** (development tool). We wrote a spec, [`docs/specs/phone-companion.md`](specs/phone-companion.md), and Kiro Crew, running locally with Kiro CLI as its agent, implemented the phone companion end to end on a branch: the command parser, pairing codes, the Upstash Redis relay and API, adaptive polling, the dashboard wiring and the phone page, with 104 tests. We reviewed its commit, fixed the runtime issues we found, and verified it with a real phone and the Vega Virtual Device. The README has a "Built with Kiro Crew" section, and PR #8 lists which commit came from Crew.
- **Amazon Bedrock.** The `/api/whats-moving` route calls Claude on Bedrock through Anthropic's `AnthropicBedrockMantle` client, the Messages API on the bedrock-mantle endpoint. It uses **structured output**, a zod schema of `{ headline, points[] }`, at `effort: "low"`.
  - The prompt contains only the current watchlist and the cached headlines.
  - The system prompt forbids outside knowledge, advice and invented causes for moves.
  - Results are cached with Next.js `'use cache'` for 10 minutes, so every TV shares about 6 calls an hour.
  - Any failure falls back to a deterministic price summary: missing credentials, no model access, a refusal or unparseable output.
  - Code: `web/app/lib/whats-moving-claude.ts`, with tested pure parts in `web/app/lib/whats-moving.ts`.
- **AWS IAM / STS and the AWS CLI.** Credentials come from the standard AWS chain: `aws login` locally, environment variables when deployed. We used `aws bedrock list-foundation-models`, `get-foundation-model-availability`, `get/put-use-case-for-model-access` and `aws service-quotas` to diagnose model access [#14–#17].

## Vega SDK, CLI and Vega Virtual Device

**What worked well**
- **Install.** One `curl | bash` installed the CLI, the SDK and the VVD, using 5.4 GB.
- **The VVD.** It boots in about 25 seconds, and `vega run-app` installs and launches in one step. That made the build-and-look loop fast.
- **The `vegaWebview` template** gave us a working WebView app on the first build. `allowSystemKeyEvents` and `allowsDefaultMediaControl` were already set.
- **Device tooling.** `inputd-cli button_press KEY_*` and `vega device start-log-stream` let us test remote behavior with no human at the keyboard, once we'd found them.

**What needs work**
- **Install docs.** They don't list the required disk space [#1], don't mention that macOS 14 prerequisites build from source [#2] or that the installer comes from a non-Amazon domain [#3], and don't document `NONINTERACTIVE` [#4].
- **`vega project generate`** writes into the current directory even when `--name` is given [#5].
- **Discoverability of device tooling.** It's hard to find key-name formats, a screenshot command that works, and logs. Early app logs are missing from the stream [#6, #7, #11].
- **The VVD has no screensaver app**, so idle behavior can't be tested on it [#13].

**Onboarding (zero to hello world)**
Rough times, not measured precisely:
- **Setup:** a few hours, mostly spent freeing disk space (the space needed isn't documented) and building Homebrew prerequisites from source.
- **First WebView on the VVD:** under half an hour once the SDK was installed.
- **Understanding remote input:** about an hour, until we built our own console bridge (below) to see what the page receives.

**Would we build with it again?** **Yes.** WebView on Vega let us ship a polished TV UI with web tooling we already knew, and the VVD made iteration fast. We'd want better docs on input, logging and keeping the screen awake.

## Vega WebView (`@amazon-devices/webview`)

**What worked well**
- **D-pad keys arrive reliably** as standard `keydown` events (keyCode 37–40 and Enter 13), including repeated presses, so we could own focus completely in app state.
- **`injectedJavaScriptBeforeContentLoaded` + `postMessage` / `onMessage`** worked as documented. We used them to forward the page's console into the device log, which made the web app debuggable on the VVD.
- **Smooth rendering.** CSS-transform animations ran smoothly on the VVD: the focus highlight, the ticker and the alert slide-in.

**What needs work**
- **Media keys.** Remote media buttons arrive as `keydown` events (`MediaPlayPause`, `MediaFastForward`, `MediaRewind`), not as Media Session actions, which the docs don't describe. Next and Previous never arrive [#8, #9].
- **Page console output** doesn't reach the device log without a custom bridge [#6].
- **Keeping the screen awake.** There's no supported way for an always-on, non-video WebView app to stop the screensaver. The Wake Lock API is rejected with `NotAllowedError` [#12].

**Would we build with it again?** **Yes.** It's the fastest way to bring a web product to Fire TV.

## Turbo Modules + User Engagement API (experiment)

**What we did:** we generated an `idl-turbo-module` and called `IKeplerUserEngagementModuleV2::makeVideoPlaybackUserEngagement()->start()` to hold off the idle screensaver.

**What worked well:** the IDL Turbo Module template compiled for all three architectures on the first try, and autolinking bundled it into the app with no extra configuration.

**What needs work:** `start()` returns successfully but doesn't prevent idle. The resource manager logs `display decoded session status … not engaged ? true`, which suggests engagement is tied to an active video decode session, and the docs don't say so [#12]. The generated template files carry an Amazon "PROPRIETARY/CONFIDENTIAL" header, which makes it unclear whether they can go into an MIT-licensed public repo.

**Would we use it again?** **Yes, if** there were a documented keep-screen-on capability for apps that aren't playing video. For an always-on dashboard that's the single most important platform feature.

## Amazon Bedrock

**What worked well**
- **The Messages-API endpoint (Mantle) with Anthropic's SDK.** The code is the same shape as the first-party Claude API, and structured outputs and the zod helper worked unchanged.
- **`aws login`.** It signs the CLI in with the console session, and the SDK picked up those credentials automatically, with no access keys to create or store [#18].
- **Model catalog and CLI diagnostics** (`get-foundation-model-availability`) quickly showed *why* a call failed: `authorizationStatus: NOT_AUTHORIZED`.

**What needs work**
- **A brand-new account can't use Claude on Bedrock on day one**, even after upgrading to the paid plan.
  - Every Claude model returns 403.
  - The required Anthropic use-case form fails with "not authorized, create a support case" in both the console and the API.
  - Every daily token quota is 0, so Amazon Nova is throttled on the first request.
  - The **free plan** pins the account to one region and doesn't include the bedrock-mantle endpoint. [#14–#16]
- **Inconsistent errors.** Opus 5.5 is listed ACTIVE but returns 404 on Mantle in eu-north-1, while other models return 403 [#17].

**Onboarding:** we signed up, upgraded and signed the CLI in on the same afternoon. We have still not made a successful Claude call from our own account; there's an open support case. The app falls back gracefully meanwhile.

**Would we build with it again?** **Yes, for the API.** The Mantle endpoint is excellent. We'd advise teams to set up and verify their AWS account days ahead, and we'd ask AWS to let new paid accounts submit the Anthropic use-case form and start with a non-zero quota.

## Kiro Crew + Kiro CLI

**What we used it for:** implementing the phone companion (QR pairing, a phone remote with text and voice, and a Redis relay to the TV) from a written spec.

**What worked well**
- **Setup:** the dashboard, the gateway and Kiro CLI sign-in with GitHub. Once the CLI was installed, Crew picked it up automatically.
- **Spec to working code:** from our spec, Crew produced a complete, well-structured feature in one run. It followed the requirements closely (R1–R15), wrote 104 unit tests, and kept lint, tests and the build green.
- **It respected the repo's conventions:** it worked on a branch, didn't push to `main`, wrote a plain commit message, and followed `AGENTS.md`.

**What needs work**
- **Installing Kiro CLI on macOS failed partway.** It hit `Operation not permitted` copying into `/Applications` and left a half-installed bundle behind [#19].
- **Green tests didn't mean working code.** Crew's unit tests never touched the real Redis client, so a library behavior (`@upstash/redis` auto-parses JSON) broke the feature at runtime: the TV never received commands. Review also found ID reuse after trimming, a reused `Response`, and stale React state [#20].
- **Crew left local folders** (`.kiro/settings/`, `_bg/`) untracked in the repo root [#21].

**Onboarding:** roughly an hour from download to a running task, most of it the Kiro CLI install issue.

**Would we build with it again?** **Yes,** for well-specified, self-contained features. Our advice: always add an integration step against real services, plus a human or second-agent review, before merging.
