<div align="center">

<img src="assets/logo.svg" alt="Coda Logo" width="140"/>

# Coda

**Your music. Your way.**

A mobile music player for iOS and Android with local library management, multi-server Navidrome streaming, crossfade, synced lyrics, and full theming support.

*Built primarily using AI models. This started as a personal project to learn more about AI models, and AI was heavily involved throughout the codebase.*

![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge)

[Website](https://codamusicplayer.vercel.app) &nbsp;&bull;&nbsp; [Download](#download) &nbsp;&bull;&nbsp; [Features](#features) &nbsp;&bull;&nbsp; [License](#license)

</div>

---

## Download

**Android** — [Download APK v1.2.0](https://github.com/graphicsprocessingunit/Coda/releases/download/v1.2.0/Coda-v1.2.0.apk)

**iOS** — [Download IPA v1.2.0](https://github.com/graphicsprocessingunit/Coda/releases/download/v1.2.0/Coda-v1.2.0.ipa), install via [AltStore](https://altstore.io) or [SideStore](https://sidestore.io).

> Notes signed with a free Apple ID expire after 7 days and must be refreshed.

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
