<div align="center">

<img src="assets/logo.svg" alt="Coda Logo" width="140"/>

# Coda

**Your music. Your way.**

A mobile music player for iOS and Android with a local library, Navidrome streaming, crossfade, synced lyrics and full theming.

*Started as a personal project to learn about AI models — built primarily with them.*

![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge)

[Website](https://codamusicplayer.vercel.app) &nbsp;&bull;&nbsp; [Download](https://github.com/graphicsprocessingunit/Coda/releases/latest) &nbsp;&bull;&nbsp; [Features](#features) &nbsp;&bull;&nbsp; [License](#license)

</div>

---

## Download

Assets are published on the [latest release](https://github.com/graphicsprocessingunit/Coda/releases/latest):

- **Android** — `Coda-v<version>.apk`
- **iOS** — `Coda-v<version>.ipa`, install via [AltStore](https://altstore.io) or [SideStore](https://sidestore.io). Free Apple ID signatures expire after 7 days.

Install steps, SHA-256 checksums, signing fingerprints and the Obtainium auto-update setup are on the [downloads page](https://codamusicplayer.vercel.app/downloads).

## Features

- **Local library** — import audio with automatic metadata and artwork extraction
- **Navidrome** — multiple Subsonic-compatible servers, with offline caching
- **Playback** — crossfade, gapless transitions, sleep timer, 5-band equalizer, speed control
- **Extras** — synced lyrics (LRCLIB), Last.fm scrobbling, smart playlists, favorites and a reorderable queue
- **4 themes** — Dark, Light, Midnight and Ocean

## Development

```bash
git clone https://github.com/Graphicsprocessingunit/Coda.git
cd Coda
npm install

npm start            # Expo dev server (npm run ios / npm run android for native runs)
npm run prebuild     # regenerate ios/ and android/ from app.json
npx tsc --noEmit     # type check
npm test             # jest
```

`ios/` and `android/` are generated and gitignored — `app.json` is the source of truth.

## Release builds

```bash
npm run build:android   # EAS cloud build → build/Coda-v<version>.apk
npm run build:ios       # local Xcode archive → build/Coda-v<version>.ipa
```

The version is read from `app.json`.

**Android** starts an EAS build, prints the build page URL immediately, then polls with a progress bar and an ETA based on the median of your recent finished builds (about 20 minutes if you have no history). On success it downloads the APK into `build/` and prints its size and SHA-256.

`Ctrl-C` stops watching only — the cloud build keeps running. Reattach to it, or to any build, by ID:

```bash
npm run build:android -- --id <build-id>
```

The last build's ID and URL are saved in `build/last-build.txt`; `eas build:list` shows older ones. Other flags: `--no-download`, `--open` (open the build page), `--timeout <seconds>` (default 3600, `0` never), `--profile <name>` (default `preview-android`).

**iOS** builds locally: archives the workspace unsigned, packages the IPA, then reports path, size and SHA-256. It runs `expo prebuild` and `pod install` first if `ios/` is missing. Flags: `--clean` (wipe `build/` first) and `--open` (reveal the IPA in Finder). EAS cloud iOS builds aren't configured — use this script.

Both scripts print their options with `--help`.

## Contributing

Open an [issue](https://github.com/graphicsprocessingunit/Coda/issues) first, then submit a focused PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

Coda is licensed under the [GNU General Public License v3.0](LICENSE). Copyright (C) 2026 Graphicsprocessingunit.

---

<div align="center">

**Owner/Maintainer: [Graphicsprocessingunit](https://github.com/Graphicsprocessingunit)**

If you enjoy Coda, please consider giving it a ⭐

</div>
