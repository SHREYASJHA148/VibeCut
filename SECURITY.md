# Security

VibeCut is a personal-project prototype. Its current source review, dependency results, fixes and remaining limits are documented in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). A clean dependency scan does not establish that an application is vulnerability-free.

## Reporting a vulnerability

Please do not publish credentials, personal audio, private files or a working exploit against a live deployment in a public issue. If GitHub private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**. Otherwise, open a minimal issue requesting a private reporting channel without including sensitive details. Private reporting has not been enabled automatically by this project.

## Deployment precautions

- Keep `.env` files, API secrets, signing keys and bearer tokens out of Git. The included `.env.example` files contain placeholders only.
- Values prefixed `EXPO_PUBLIC_` become public browser/app configuration. Never put secrets in them.
- Host the optional metadata server privately over HTTPS. Configure exact allowed hosts and browser origins, use a random token of at least 32 characters, and apply edge rate limits if using multiple processes or exposing it publicly.
- Rebuild native apps after permission, backup or WebView changes. Native-device and compiled-release security tests are still outstanding.
- Development servers are not production hosting. Default scripts bind to localhost; expose a LAN server only intentionally on a trusted network.
- Imports stay in device/browser storage. Clearing site data, changing the site origin or uninstalling can remove the library. Back up originals and exported mixes yourself.

Use only music you have permission to edit. Streaming availability does not grant download, remix or redistribution rights. The official YouTube player retains its controls and platform restrictions.
