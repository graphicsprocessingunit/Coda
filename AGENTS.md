# Expo SDK 54

This project uses Expo SDK **54** (installed: 54.0.35). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo-related code.

## Commands

- `npm start` — Expo dev server (use `npx expo start` if npm script fails)
- `npm run ios` / `npm run android` — platform-specific launch
- `npm run prebuild` — regenerate `ios/` and `android/` native projects from `app.json`
- `npm test` — run unit tests (jest-expo)
- `npx tsc --noEmit` — type checking

## Native project regeneration

The `ios/` and `android/` directories are generated (`gitignored`) and are NOT the source of truth — `app.json` is. Run `npm run prebuild` after ANY native-affecting change (edits to `app.json` `ios.infoPlist`/permissions/icons/plugins, or installing an npm package with native code) before building in Xcode/Android Studio or submitting an EAS build. JS/TS-only changes never need prebuild. Running `expo prebuild` may print `userInterfaceStyle` hints — resolved by `expo-system-ui` (already installed).

## Architecture

- **Entry**: `index.ts` → `App.tsx` (registers root component via `registerRootComponent`)
- **Navigation**: Bottom tabs (Player, Library, Playlists, Settings). Playlists tab has its own Stack navigator.
- **State**: Two React Contexts — `AudioContext` (audio engine, library, playlists, queue) and `ThemeContext` (4 themes: dark/light/midnight/ocean). All state lives in context, no Redux/Zustand.
- **Persistence**: `AsyncStorage` via `StorageService` — library, playlists, current track, playback position, queue. Navidrome/Last.fm login secrets stored encrypted in settings JSON (`CryptoService`), with `expo-secure-store` as the key store and legacy fallback. Theme stored separately in `ThemeContext`.
- **Audio**: `expo-audio` with background playback enabled (`UIBackgroundModes: ["audio"]` on iOS). Lock screen / Control Center metadata via `player.setActiveForLockScreen()`. Use `createAudioPlayer` (imperative API) inside AudioContext, not `useAudioPlayer` (hook API). Audio session uses `interruptionMode: 'doNotMix'` for lock screen controls. Supports crossfade and seamless/gapless playback modes.
- **Encryption**: `CryptoService` (`src/services/CryptoService.ts`) uses AES-256-GCM via `@noble/ciphers` (pure JS, no native crypto lib) with a 32-byte key held in `expo-secure-store` (`@coda_encryption_key`) and 12-byte nonces from `expo-crypto`'s `getRandomBytes`. Output format: `v1:<base64(nonce‖ciphertext‖tag)>`. Key is generated once and cached in memory. Depends only on byte arrays — no `TextEncoder`/`btoa` reliance in production code (own UTF-8/base64 helpers). If a JS test ever needs to run noble's ESM, keep `@noble` in `jest.config.js` `transformIgnorePatterns` allowlist.
- **Offline cache**: `OfflineCacheService` downloads Navidrome tracks and artwork to local filesystem for offline playback. TrackMetadata carries `cachedUri`/`cachedArtwork` fields.
- **File import**: `expo-document-picker` → `FilePickerService` converts picked files to `TrackMetadata`.

## Key types (defined in `src/context/AudioContext.tsx`)

- `TrackMetadata`: `{ title, artist, uri, duration?, artwork? }`
- `Playlist`: `{ id, name, tracks: TrackMetadata[], createdAt }`

## Storage layout

All app files live under `Paths.document/Coda/` (user-browsable in iOS Files → On My iPhone, via `UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace`). Managed exclusively through `AppStorageService`:

- `Coda/Downloads/audio` — offline Navidrome tracks (`OfflineCacheService`)
- `Coda/Downloads/artwork` — cached Navidrome + extracted local artwork
- `Coda/Music` — imported local audio files (`FilePickerService`)
- `Coda/Settings` — settings JSON (`navidrome-settings.json`, `lastfm-settings.json`)

**Never store credentials/secrets in plaintext in the user-visible JSON.** Navidrome password and Last.fm apiKey/sharedSecret/sessionKey are stored in the settings JSON only as AES-256-GCM ciphertext blobs (`CryptoService`, key in `expo-secure-store` `@coda_encryption_key`); non-sensitive display fields (server URL, username) stay plaintext. Legacy `expo-secure-store` keys (`@coda_navidrome_credentials`, `@coda_lastfm_credentials`) remain as fallback so existing users stay connected, and are refreshed on every load. `loadCredentials` (NavidromeService/LastFmService) reads the encrypted settings first, then falls back to SecureStore/AsyncStorage. `AudioContext.loadSavedData` runs `ensureStructure()` + migrations (in try/catch — never abort on migration failure) before `scanCacheDirectory()` revalidation so `cachedUri`/`cachedArtwork` self-heal after a layout change.

## Conventions

- Components in `src/components/`, contexts in `src/context/`, services in `src/services/`. `src/screens/` exists but is empty — screens are defined inline in `App.tsx`.
- Theming: access via `useTheme()` hook, never hardcode colors.
- Audio state: access via `useAudio()` hook.
- TypeScript strict mode enabled (`tsconfig.json`).
- Icons use `@expo/vector-icons` (Ionicons).
