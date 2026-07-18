# Expo SDK 54

This project uses Expo SDK **54** (installed: 54.0.35). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo-related code.

## Commands

- `npm start` — Expo dev server (use `npx expo start` if npm script fails)
- `npm run ios` / `npm run android` — platform-specific launch
- `npm test` — run unit tests (jest-expo)
- `npx tsc --noEmit` — type checking

## Architecture

- **Entry**: `index.ts` → `App.tsx` (registers root component via `registerRootComponent`)
- **Navigation**: Bottom tabs (Player, Library, Playlists, Settings). Playlists tab has its own Stack navigator.
- **State**: Two React Contexts — `AudioContext` (audio engine, library, playlists, queue) and `ThemeContext` (4 themes: dark/light/midnight/ocean). All state lives in context, no Redux/Zustand.
- **Persistence**: `AsyncStorage` via `StorageService` — library, playlists, current track, playback position, queue. Navidrome credentials stored in `expo-secure-store` via `NavidromeService` (auto-migrates from AsyncStorage). Theme stored separately in `ThemeContext`.
- **Audio**: `expo-audio` with background playback enabled (`UIBackgroundModes: ["audio"]` on iOS). Lock screen / Control Center metadata via `player.setActiveForLockScreen()`. Use `createAudioPlayer` (imperative API) inside AudioContext, not `useAudioPlayer` (hook API). Audio session uses `interruptionMode: 'doNotMix'` for lock screen controls. Supports crossfade and seamless/gapless playback modes.
- **Offline cache**: `OfflineCacheService` downloads Navidrome tracks and artwork to local filesystem for offline playback. TrackMetadata carries `cachedUri`/`cachedArtwork` fields.
- **File import**: `expo-document-picker` → `FilePickerService` converts picked files to `TrackMetadata`.

## Key types (defined in `src/context/AudioContext.tsx`)

- `TrackMetadata`: `{ title, artist, uri, duration?, artwork? }`
- `Playlist`: `{ id, name, tracks: TrackMetadata[], createdAt }`

## Conventions

- Components in `src/components/`, contexts in `src/context/`, services in `src/services/`. `src/screens/` exists but is empty — screens are defined inline in `App.tsx`.
- Theming: access via `useTheme()` hook, never hardcode colors.
- Audio state: access via `useAudio()` hook.
- TypeScript strict mode enabled (`tsconfig.json`).
- Icons use `@expo/vector-icons` (Ionicons).
