<div align="center">

<img src="assets/logo.svg" alt="Coda Logo" width="140"/>

# Coda

**Your music. Your way.**

A mobile music player for iOS and Android with local library management, multi-server Navidrome streaming, crossfade, synced lyrics, and full theming support.

*Built primarily using AI models. This started as a personal project to learn more about AI models.*

![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge)

[Website](https://codamusicplayer.vercel.app) &nbsp;&bull;&nbsp; [Download](#download) &nbsp;&bull;&nbsp; [Features](#features) &nbsp;&bull;&nbsp; [License](#license)

</div>

---

## Download

**Android** — [Download APK v1.4.0](https://github.com/graphicsprocessingunit/Coda/releases/download/v1.4.0/Coda-v1.4.0.apk)

**iOS** — [Download IPA v1.5.0](https://github.com/graphicsprocessingunit/Coda/releases/download/v1.5.0/Coda-v1.5.0.ipa), install via [AltStore](https://altstore.io) or [SideStore](https://sidestore.io).

> Notes signed with a free Apple ID expire after 7 days and must be refreshed. The Android APK remains on v1.4.0 until the next Android build.

### Installing on Android

1. Download `Coda-v<version>.apk` from the [latest release](https://github.com/graphicsprocessingunit/Coda/releases/latest).
2. Open the file and allow **Install unknown apps** for the app you downloaded it with (Chrome, Files, etc.) if prompted.
3. Tap **Install**. Android may show a Play Protect scan notice; choose **Install anyway** to continue.

### Auto-updates with Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) installs and updates apps directly from GitHub releases — no account required.

1. Install Obtainium (via [F-Droid or its release page](https://github.com/ImranR98/Obtainium/releases)).
2. Tap **Add App** and paste the repository URL: `https://github.com/graphicsprocessingunit/Coda`.
3. Obtainium detects the `Coda-v<version>.apk` release asset. Tap **Add**.
4. Future releases appear on the **Updates** tab. Note that Obtainium replaces its own installed copy; if you first installed the APK manually, uninstall it before letting Obtainium manage updates (or vice versa) to avoid a signature clash.

### Verifying your download

Release assets are published with SHA-256 checksums and the Android signing-certificate fingerprint so you can confirm you have an untampered build.

**Checksum (macOS / Linux):**

```bash
shasum -a 256 Coda-v<version>.apk
```

**Checksum (Windows, PowerShell):**

```powershell
Get-FileHash Coda-v<version>.apk -Algorithm SHA256
```

Compare the output against the value posted in the release notes.

**Signing certificate fingerprint** — verify the APK was signed by the Coda release key using `apksigner` (Android SDK build-tools):

```bash
apksigner verify --print-certs Coda-v<version>.apk
```

The `Signer #1 certificate SHA-256 digest` must match the fingerprint published in the release notes.

### Android developer verification

Google is rolling out [Android developer verification](https://developer.android.com/developer-verification): apps must be registered by verified developers to install from participating app stores on certified devices. Enforcement begins **September 30, 2026** for participating stores in **Brazil, Indonesia, Singapore, and Thailand**, and expands **globally in 2027**.

- **Direct sideloading** (downloading the APK yourself) and the **ADB** workflow are **not affected** in the initial phase and remain available.
- Power users installing unregistered apps may later use Android's **advanced flow** (a one-time, informed-consent setup) or **ADB**.
- Coda's developer is planning registration ahead of the global rollout. If enforcement ever affects your region, the Obtainium path above continues to work with a verified release.

## Features

- **Local Library** — import audio with automatic metadata and artwork extraction
- **Navidrome Streaming** — connect to multiple Subsonic-compatible servers and switch between them
- **Playback** — crossfade, gapless transitions, sleep timer, 5-band equalizer, playback speed
- **Smart Playlists** — rule-based auto-updating collections
- **Synced Lyrics** — auto-scrolling via LRCLIB
- **Last.fm Scrobbling** — with secure credential storage
- **Favorites, Queue & Batch Ops** — heart tracks, drag-to-reorder queue, bulk actions
- **4 Themes** — Dark, Light, Midnight, and Ocean with accent color support

## Development

```bash
git clone https://github.com/Graphicsprocessingunit/Coda.git
cd Coda
npm install

npx expo prebuild --clean   # generate native projects (iOS/Android)
npx expo start              # start dev server
npx tsc --noEmit            # type check
npm test                    # run tests
```

## Contributing

Open an [issue](https://github.com/graphicsprocessingunit/Coda/issues) first, then submit a focused PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

Coda is licensed under the [GNU General Public License v3.0](LICENSE).

Copyright (C) 2026 Graphicsprocessingunit. See the [LICENSE](LICENSE) file for the full text.

---

<div align="center">

**Owner/Maintainer: [Graphicsprocessingunit](https://github.com/Graphicsprocessingunit)**

If you enjoy Coda, please consider giving it a ⭐

</div>
