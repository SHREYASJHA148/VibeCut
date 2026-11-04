# VibeCut security audit — 4 November 2026

The reviewed scope is VibeCut's React Native/web source, private FastAPI metadata proxy, dependency manifests/locks, local data/file handling, embedded player, generated Android configuration and the running local preview. This is a source/dependency review with targeted security tests, not a guarantee that every vulnerability has been found or a physical-device penetration test.

## Results

| Check | Result |
|---|---|
| npm runtime dependency audit (`--omit=dev`) | **0 known advisories** after fixes |
| npm full dependency audit | 13 moderate development-tool alerts; see the advisory discrepancy below |
| npm registry signatures | No invalid or missing signatures reported |
| Python runtime dependency audit | No known advisories in the resolved runtime dependencies |
| Bandit scan of server implementation | No findings |
| Local high-signal credential scan, source and mobile Git history | No matching credential patterns found; values are never printed |
| Unit tests | 22 pass |
| Backend security/functionality tests | 8 pass |
| Browser end-to-end tests | 11 pass; the two security tests also pass in a targeted rerun |
| TypeScript / ESLint / Expo checks | Pass; Expo 20/20 |
| Android / iOS / web JavaScript exports | Pass |
| Live music regression | Audius audio and the official embedded YouTube player still play in the browser |

## Fixes and hardening

| Area | Finding / improvement | Implemented protection |
|---|---|---|
| Build dependencies | Vulnerable glob 13 and minimatch 10 in Expo/TypeScript tooling | Version-scoped overrides to glob 14.0.3 and minimatch 11.0.4; committed package lock. Lint, Metro, Expo configuration and exports verified after upgrading. No forced Expo downgrade. |
| Local file deletion | A tampered stored URI could reach a generic file delete operation | Native deletion is restricted to a single generated file inside VibeCut's private audio directory. Encoded traversal, siblings, nested paths and other URI schemes are rejected. Browser deletion only accepts the app's IndexedDB audio IDs. |
| Playback references | Persisted records could reference arbitrary network/local resources | Platform URI resolution accepts only owned imports or canonical Audius stream URLs. Library source/type consistency is checked on load. The mixing engine rejects HTTP sources. |
| Imports | The picker-reported file size could be missing or wrong | Check native source and copied-file sizes and actual browser Blob size against 40 MB before storage/analysis. Duration is checked before decoding. Unsupported multichannel studio buffers are rejected. |
| Untrusted saved data | Shallow array checks allowed malformed nested objects and native audio parameters | Validate records, references, finite values, project duration/lanes/clip count/fades/gain and collection limits. Corrupt data fails closed and is preserved instead of overwritten. Reads over 16 MB are rejected before JSON parsing. |
| Audio resource use | Repeated clips could concurrently decode the same source many times | Share one in-flight decode per source, bound cached sources and validate schedules before preview/export. |
| Server settings | Prefix-only URL checks accepted misleading addresses and embedded credentials | Parse URLs, require HTTPS except explicit development loopback hosts, reject userinfo/query/fragment, bound URL/token lengths and reject header control characters. Validate persisted server addresses again when reading. |
| Authenticated network calls | Redirects could move a private request outside its configured endpoint | Health/search requests use redirect rejection. A browser test verifies a real authenticated GET receives a redirect without following it to the attacker destination. |
| Provider data | JSON bodies and metadata structure were insufficiently bounded | Bound streamed JSON bytes and declared Content-Length, cap result counts and text lengths, validate item types and HTTPS artwork, and avoid reflecting raw invalid JSON in errors. Expo's native fetch implementation supports the redirect and streaming controls used here. |
| Native embedded browser | Wildcard static-HTML loading lacked a navigation boundary and explicit file-access restrictions | Keep the wildcard required for local HTML, but enforce top-level HTTPS app/YouTube origins; reject file/data/intent/script schemes, disable file/universal access and mixed content, restrict automatic windows, validate external HTTPS links and bound bridge messages to 2 KB. No credential/file operations are exposed through the bridge. |
| Native privacy | Android backup was enabled | Set Android `allowBackup=false`; generated manifest verified. New/resaved API tokens use device-only, unlocked SecureStore accessibility. |
| Android permissions | Legacy storage access was broader than the system picker needs | Block broad read/write external-storage and microphone permissions through Expo configuration. A rebuilt native manifest is required to apply the changes. The app imports user-selected files through the system picker and uses private storage. |
| Private server credentials | Short/example tokens were accepted | Require at least 32 characters, reject placeholder/whitespace/control-character tokens, retain constant-time comparisons and limit supplied authorization length. Generate tokens with `secrets.token_urlsafe(32)`. |
| Server abuse / upstream quotas | No application request/concurrency budgets | Bounded per-client auth rate limit, process-wide uncached-search rate limit, four upstream requests maximum, total eight-second timeout and 512 KB upstream response limit. Requests remain private/authenticated. |
| Server exposure | Unexpected Host values and public schema routes were accepted | Trusted Host allowlist, disabled documentation/schema endpoints, narrow CORS origin and no-store/nosniff/frame/referrer headers. Outgoing provider destination is fixed and redirects are rejected. |
| Runtime reproducibility | Only direct Python dependencies were pinned | Add constraints for the audited runtime resolution; install and test that exact resolution in an isolated environment. |
| Development exposure | Preview was listening on all interfaces | Restarted on **127.0.0.1:8081**, verified via the OS listening socket. Default preview/start scripts and browser-test startup use localhost. |

File deletion and stored-record issues require malicious or modified local data; these are not claims of unauthenticated remote exploitation. The added boundaries also protect future import/sync work.

## Remaining npm alert discrepancy

The raw full audit still reports **13 moderate cascading alerts in ESLint/development tooling**, rooted in its installed `minimatch@3.1.5`. npm's response labels every version below 11.0.1 as affected. However, the current upstream GitHub advisory, updated on 4 November, identifies the affected range as **>=7.0.0 and <11.0.1**, and describes preprocessing functionality introduced after v3. The installed dependency tree contains v3.1.5 and patched v11.0.4; no v7–10 remains.

This disagreement is recorded, not suppressed. Replacing v3 with v11 would break legacy consumers' different module API, so that replacement was not forced merely to clear the counter. Recheck when npm's advisory data changes. The runtime-only audit is clean.

Sources: [minimatch affected range](https://github.com/advisories/GHSA-g3hv-75wg-m249), [glob fixed version](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Raw machine-readable reports are retained as `mobile/audit-results.json`, `mobile/audit-runtime.json`, `pip-audit.json` and `bandit.json` in this workspace.

## Limits and deployment actions

- No native APK/IPA was compiled or installed here. There is no Android SDK/device or macOS/iOS build environment. Android permission merging, backup behavior, SecureStore accessibility, WebView navigation/media and OS decoder behavior require rebuilt-device tests. Prebuild/configuration and JavaScript exports are not equivalent to those tests.
- No external deployment, TLS terminator, Tailscale configuration or real metadata API key was available for penetration testing. Configure exact `VIBECUT_ALLOWED_HOSTS` and `VIBECUT_WEB_ORIGIN`, generate a new strong bearer token and use private HTTPS. Rate limits are per process; a public/multi-worker deployment needs edge limits too.
- Existing native installs need rebuilding to apply permission/backup changes. Re-save any previously configured native token in Settings to apply the stricter keychain attributes.
- The audit does not inspect the operating system, every media-decoder implementation or the security of YouTube/Audius/Last.fm. The official YouTube API script and remote services remain third-party trust dependencies. Registry signatures and a clean advisory scan do not prove package code harmless.
- The local credential scan covers selected high-signal formats and scanned text/history, not every possible credential encoding, inaccessible file or deleted object.
- Physical-device fuzzing, large-project memory testing, independent penetration testing and security assessment of a compiled release remain outstanding.

## Reproduce

```powershell
cd C:\VibeCut\mobile
npm audit --omit=dev
npm audit
npm audit signatures
npm run typecheck
npm run lint
npm test
npx playwright test
npx expo-doctor
cd C:\VibeCut
python -m unittest server.test_main -v
python tools/security_scan.py
```

Python scanner commands used in the isolated `.security-venv` environment: `python -m pip_audit -r server/requirements.txt` and `python -m bandit -r server -x test_main.py`. Keep the constraints/lock files and re-run the scans on future updates.
