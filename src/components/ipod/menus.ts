import { Alert, Linking } from 'react-native';
import {
  useAudio,
  TrackMetadata,
  Playlist,
  SmartPlaylist,
  BatchDownload,
} from '../../context/AudioContext';
import { Theme, AppLayout, IpodPalette, ThemeColors } from '../../context/ThemeContext';
import {
  NavidromeArtist,
  NavidromeAlbum,
  NavidromeSong,
  NavidromeService,
} from '../../services/NavidromeService';
import { OfflineCacheService } from '../../services/OfflineCacheService';
import { evaluateSmartPlaylist } from '../../services/SmartPlaylistEngine';
import { IPOD_FINISHES } from './ipodTheme';

export type AudioApi = ReturnType<typeof useAudio>;

export type SettingsSection =
  | 'root'
  | 'appearance'
  | 'finish'
  | 'audio'
  | 'navidrome'
  | 'lastfm'
  | 'about'
  | 'eq'
  | 'audiofx'
  | 'sleep'
  | 'crossfade'
  | 'navidromeSettings'
  | 'lastfmPanel';

export const EMBED_SECTIONS: SettingsSection[] = ['eq', 'audiofx', 'sleep', 'crossfade', 'navidromeSettings', 'lastfmPanel'];

export interface IpodScreen {
  type: string;
  highlight: number;
  title?: string;
  tracks?: TrackMetadata[];
  playlistId?: string;
  from?: number | null;
  query?: string;
  track?: TrackMetadata;
  section?: SettingsSection;
  view?: 'artists' | 'albums' | 'songs';
  key?: string;
  artist?: NavidromeArtist;
  album?: NavidromeAlbum;
  volumeMode?: boolean;
  lyricsOpen?: boolean;
}

export type IpodRowKind = 'nav' | 'track' | 'action';

export interface IpodRow {
  key: string;
  kind: IpodRowKind;
  label: string;
  sub?: string;
  right?: string;
  swatchColor?: string;
  chevron?: boolean;
  action: () => void;
  longPress?: () => void;
}

export interface RowsCtx {
  audio: AudioApi;
  colors: ThemeColors;
  ipod: IpodPalette;
  theme: Theme;
  layout: AppLayout;
  setTheme: (t: Theme) => void;
  setLayout: (l: AppLayout) => void;
  setIpodFinish: (finishId: string) => void;
  resetIpodFinish: () => void;
  batches: Map<string, BatchDownload>;
  startBatchDownload: (tracks: TrackMetadata[], label: string, key: string) => void;
  navidromeData: Record<string, NavidromeArtist[] | NavidromeAlbum[] | NavidromeSong[]>;
  nav: { push: (s: IpodScreen) => void; pop: () => void; replace: (s: IpodScreen) => void };
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  prompt: (title: string, initial: string, onSubmit: (value: string) => void) => void;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function filterLibrary(library: TrackMetadata[], query: string): TrackMetadata[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return library.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album ?? '').toLowerCase().includes(q)
  );
}

function sortedUniqueValues(list: TrackMetadata[], pick: (t: TrackMetadata) => string): string[] {
  const set = new Set<string>();
  for (const t of list) set.add(pick(t) || 'Unknown');
  return [...set].sort((a, b) => a.localeCompare(b));
}

const createNavRow = (label: string, action: () => void, opts: Partial<IpodRow> = {}): IpodRow => ({
  key: `nav:${label}`,
  kind: 'nav',
  label,
  chevron: true,
  action,
  ...opts,
});

export function buildReorderRows(
  tracks: TrackMetadata[],
  from: number | null,
  highlight: number
): IpodRow[] {
  const n = tracks.length;
  const target = clampIndex(highlight, Math.max(1, n));
  if (from === null || from === undefined) {
    return tracks.map((t, i) => ({
      key: `re:${i}`,
      kind: 'track',
      label: t.title,
      sub: t.artist,
      right: `${i + 1}`,
      chevron: false,
      action: () => {},
    }));
  }
  const otherIndexes = tracks.map((_, i) => i).filter((i) => i !== from);
  let k = 0;
  const preview: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === target && from != null) {
      preview.push(from);
    } else {
      preview.push(otherIndexes[k++]);
    }
  }
  return preview.map((orig, i) => {
    const t = tracks[orig];
    const isMoving = orig === from;
    return {
      key: `re:${orig}:${i}`,
      kind: 'track',
      label: isMoving ? `⏵ ${t.title}` : t.title,
      sub: isMoving ? `Drop at position ${target + 1} by pressing Select` : t.artist,
      right: !isMoving ? `${i + 1}` : 'MOVE',
      chevron: false,
      action: () => {},
    };
  });
}

function createTrackRow(
  key: string,
  track: TrackMetadata,
  action: () => void,
  ctx: RowsCtx,
  opts: Partial<IpodRow> = {}
): IpodRow {
  const isCurrent = ctx.audio.currentTrack?.uri === track.uri;
  const cached = OfflineCacheService.isTrackCached(track);
  return {
    key,
    kind: 'track',
    label: track.title,
    sub: track.artist,
    right: `${isCurrent ? '♪ ' : ''}${fmtDuration(track.duration)}${cached ? ' ↓' : ''}`,
    action,
    ...opts,
  };
}

export function playLibraryTrack(ctx: RowsCtx, track: TrackMetadata) {
  ctx.audio.playFromLibrary(track).catch((e) => ctx.toast(`Playback failed: ${e?.message ?? e}`, 'error'));
}

export function showTrackActions(ctx: RowsCtx, track: TrackMetadata) {
  const cached = OfflineCacheService.isTrackCached(track);
  Alert.alert(track.title, track.artist, [
    {
      text: 'Play Next',
      onPress: () => {
        ctx.audio.playNextInQueue(track);
        ctx.toast('Added to Up Next', 'info');
      },
    },
    {
      text: 'Add to Queue',
      onPress: () => {
        ctx.audio.addToQueue(track);
        ctx.toast('Added to Queue', 'info');
      },
    },
    {
      text: 'Add to Playlist',
      onPress: () => ctx.nav.push({ type: 'pickPlaylist', track, highlight: 0 }),
    },
    {
      text: track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      onPress: () => {
        ctx.audio.toggleFavorite(track.uri);
        ctx.toast(track.isFavorite ? 'Removed from Favorites' : 'Added to Favorites', 'info');
      },
    },
    ...(track.source === 'navidrome' && !cached
      ? [
          {
            text: 'Download for Offline',
            onPress: () => {
              ctx.audio
                .downloadTrackForLibrary(track)
                .then(() => ctx.toast('Downloaded', 'success'))
                .catch(() => ctx.toast('Download failed', 'error'));
            },
          },
        ]
      : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function maybeEmpty(rows: IpodRow[], message: string): IpodRow[] {
  if (rows.length > 0) return rows;
  return [{ key: 'empty', kind: 'action', label: message, action: () => {} }];
}

export function buildRows(screen: IpodScreen, ctx: RowsCtx): IpodRow[] {
  switch (screen.type) {
    case 'root':
      return buildRoot(ctx);
    case 'music':
      return buildMusic(ctx);
    case 'tracks':
      return maybeEmpty(
        (screen.tracks ?? []).map((t) =>
          createTrackRow(`trk:${t.uri}`, t, () => playLibraryTrack(ctx, t), ctx, {
            longPress: () => showTrackActions(ctx, t),
          })
        ),
        'No tracks'
      );
    case 'artists':
      return maybeEmpty(
        sortedUniqueValues(ctx.audio.library, (t) => t.artist).map((artist) => {
          const list = ctx.audio.library.filter((t) => (t.artist || 'Unknown') === artist);
          return createNavRow(artist, () => ctx.nav.push({ type: 'tracks', title: artist, tracks: list, highlight: 0 }), {
            sub: `${list.length} ${list.length === 1 ? 'track' : 'tracks'}`,
          });
        }),
        'No artists — add music first'
      );
    case 'albums':
      return maybeEmpty(
        sortedUniqueValues(ctx.audio.library, (t) => t.album ?? '').map((album) => {
          const list = ctx.audio.library.filter((t) => (t.album || 'Unknown Album') === album);
          const artistCount = new Set(list.map((t) => t.artist)).size;
          return createNavRow(album, () => ctx.nav.push({ type: 'tracks', title: album, tracks: list, highlight: 0 }), {
            sub: `${list.length} ${list.length === 1 ? 'track' : 'tracks'}${artistCount > 1 ? ' · compilation' : ''}`,
          });
        }),
        'No albums — add music first'
      );
    case 'playlists':
      return [
        createNavRow('Create Playlist', () =>
          ctx.prompt('Playlist Name', '', (name) => {
            const id = ctx.audio.createPlaylist(name.trim());
            ctx.toast('Playlist created', 'success');
            ctx.nav.push({ type: 'playlist', playlistId: id, highlight: 0 });
          })
        ),
        ...(ctx.audio.smartPlaylists.length > 0
          ? [
              createNavRow('Smart Playlists', () => ctx.nav.push({ type: 'smart', highlight: 0 }), {
                sub: `${ctx.audio.smartPlaylists.length} playlists`,
              }),
            ]
          : []),
        ...ctx.audio.playlists.map((p) =>
          createNavRow(p.name, () => ctx.nav.push({ type: 'playlist', playlistId: p.id, highlight: 0 }), {
            sub: `${p.tracks.length} tracks`,
          })
        ),
      ];
    case 'smart':
      return maybeEmpty(
        ctx.audio.smartPlaylists.map((sp: SmartPlaylist) => {
          const evaluated = evaluateSmartPlaylist(ctx.audio.library, sp);
          return createNavRow(sp.name, () => ctx.nav.push({ type: 'tracks', title: sp.name, tracks: evaluated, highlight: 0 }), {
            sub: `${evaluated.length} tracks`,
          });
        }),
        'No smart playlists'
      );
    case 'reorder': {
      const playlist = ctx.audio.playlists.find((p) => p.id === screen.playlistId);
      if (!playlist) return [];
      return buildReorderRows(playlist.tracks, screen.from ?? null, screen.highlight);
    }
    case 'playlist': {
      const playlist = ctx.audio.playlists.find((p) => p.id === screen.playlistId);
      if (!playlist) return [{ key: 'gone', kind: 'action', label: 'Playlist not found', action: () => {} }];
      const anyRemote = playlist.tracks.some((t) => t.source === 'navidrome' && !OfflineCacheService.isTrackCached(t));
      return [
        ...playlist.tracks.map((t) =>
          createTrackRow(
            `pltrk:${t.uri}`,
            t,
            () =>
              ctx.audio.playFromPlaylist(playlist, t).catch((e) => ctx.toast(`Playback failed: ${e?.message ?? e}`, 'error')),
            ctx,
            { longPress: () => showTrackActions(ctx, t) }
          )
        ),
        ...(anyRemote && ctx.audio.navidromeConnected
          ? [
              createNavRow('Download All', () => {
                ctx.startBatchDownload(playlist.tracks, playlist.name, `module:playlist:${playlist.id}`);
                ctx.toast('Downloading playlist…', 'info');
              }),
            ]
          : []),
        createNavRow('Reorder Mode', () => ctx.nav.push({ type: 'reorder', playlistId: playlist.id, from: null, highlight: 0 })),
        createNavRow('Rename', () =>
          ctx.prompt('Rename Playlist', playlist.name, (name) => {
            ctx.audio.renamePlaylist(playlist.id, name.trim());
            ctx.toast('Renamed', 'success');
          })
        ),
        createNavRow('Delete Playlist', () =>
          Alert.alert('Delete Playlist?', playlist.name, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                ctx.audio.deletePlaylist(playlist.id);
                ctx.nav.pop();
                ctx.toast('Playlist deleted', 'info');
              },
            },
          ])
        ),
      ];
    }
    case 'pickPlaylist': {
      const track = screen.track;
      if (!track) return [];
      return [
        createNavRow('New Playlist', () =>
          ctx.prompt('Playlist Name', '', (name) => {
            const id = ctx.audio.createPlaylist(name.trim());
            ctx.audio.addTrackToPlaylist(id, track);
            ctx.toast('Added to playlist', 'success');
            ctx.nav.pop();
          })
        ),
        ...ctx.audio.playlists.map((p: Playlist) =>
          createNavRow(p.name, () => {
            ctx.audio.addTrackToPlaylist(p.id, track);
            ctx.toast(`Added to ${p.name}`, 'success');
            ctx.nav.pop();
          }, { sub: `${p.tracks.length} tracks` })
        ),
      ];
    }
    case 'search': {
      const query = screen.query ?? '';
      return maybeEmpty(
        filterLibrary(ctx.audio.library, query).map((t) =>
          createTrackRow(`srch:${t.uri}`, t, () => playLibraryTrack(ctx, t), ctx, {
            longPress: () => showTrackActions(ctx, t),
          })
        ),
        query.trim() ? 'No results' : 'Type to search'
      );
    }
    case 'settings':
      return buildSettings(screen.section ?? 'root', ctx);
    case 'navidrome':
      return buildNavidrome(screen, ctx);
    default:
      return [];
  }
}

function buildRoot(ctx: RowsCtx): IpodRow[] {
  return [
    createNavRow('Now Playing', () => ctx.nav.push({ type: 'nowplaying', highlight: 0 }), {
      sub: ctx.audio.currentTrack ? `${ctx.audio.currentTrack.title} — ${ctx.audio.currentTrack.artist}` : 'Nothing playing',
    }),
    createNavRow('Music Library', () => ctx.nav.push({ type: 'music', highlight: 0 }), {
      sub: `${ctx.audio.library.length} tracks`,
    }),
    createNavRow('Playlists', () => ctx.nav.push({ type: 'playlists', highlight: 0 }), {
      sub: `${ctx.audio.playlists.length} playlists`,
    }),
    createNavRow(
      ctx.audio.navidromeConnected ? 'Navidrome' : 'Navidrome (offline)',
      () =>
        ctx.audio.navidromeConnected
          ? ctx.nav.push({ type: 'navidrome', view: 'artists', key: 'artists', highlight: 0 })
          : ctx.nav.push({ type: 'settings', section: 'navidromeSettings', highlight: 0 }),
      { sub: ctx.audio.navidromeConnected ? ctx.audio.navidromeServerUrl : 'Not connected' }
    ),
    createNavRow('Settings', () => ctx.nav.push({ type: 'settings', section: 'root', highlight: 0 })),
  ];
}

function buildMusic(ctx: RowsCtx): IpodRow[] {
  const library = ctx.audio.library;
  const favorites = library.filter((t) => t.isFavorite);
  const downloads = library.filter((t) => OfflineCacheService.isTrackCached(t));
  return [
    createNavRow('Library', () => ctx.nav.push({ type: 'tracks', title: 'Library', tracks: library, highlight: 0 }), {
      sub: `${library.length} tracks`,
    }),
    createNavRow('Artists', () => ctx.nav.push({ type: 'artists', highlight: 0 })),
    createNavRow('Albums', () => ctx.nav.push({ type: 'albums', highlight: 0 })),
    createNavRow('Favorites', () => ctx.nav.push({ type: 'tracks', title: 'Favorites', tracks: favorites, highlight: 0 }), {
      sub: `${favorites.length} tracks`,
    }),
    createNavRow('Downloads', () => ctx.nav.push({ type: 'tracks', title: 'Downloads', tracks: downloads, highlight: 0 }), {
      sub: `${downloads.length} tracks offline`,
    }),
    createNavRow('Search', () => ctx.nav.push({ type: 'search', query: '', highlight: 0 })),
  ];
}

const THEME_SWATCHES: { theme: Theme; color: string }[] = [
  { theme: 'dark', color: '#000000' },
  { theme: 'light', color: '#F2F2F7' },
  { theme: 'midnight', color: '#0A0E27' },
  { theme: 'ocean', color: '#0F172A' },
];

function buildSettings(section: SettingsSection, ctx: RowsCtx): IpodRow[] {
  switch (section) {
    case 'root':
      return [
        createNavRow('Appearance', () => ctx.nav.push({ type: 'settings', section: 'appearance', highlight: 0 }), {
          sub: ctx.layout === 'ipod' ? 'iPod Classic' : 'Standard',
        }),
        createNavRow('Audio', () => ctx.nav.push({ type: 'settings', section: 'audio', highlight: 0 })),
        createNavRow('Navidrome', () => ctx.nav.push({ type: 'settings', section: 'navidrome', highlight: 0 }), {
          sub: ctx.audio.navidromeConnected ? 'Connected' : 'Not connected',
        }),
        createNavRow('Last.fm', () => ctx.nav.push({ type: 'settings', section: 'lastfm', highlight: 0 }), {
          sub: ctx.audio.lastFmConnected ? 'Connected' : 'Not connected',
        }),
        createNavRow('About', () => ctx.nav.push({ type: 'settings', section: 'about', highlight: 0 })),
      ];
    case 'appearance':
      return [
        createNavRow('Layout: Standard', () => ctx.setLayout('standard'), {
          right: ctx.layout === 'standard' ? '●' : '',
        }),
        createNavRow('Layout: iPod Classic', () => ctx.setLayout('ipod'), {
          right: ctx.layout === 'ipod' ? '●' : '',
        }),
        ...THEME_SWATCHES.map((s) =>
          createNavRow(`${s.theme.charAt(0).toUpperCase()}${s.theme.slice(1)}`, () => ctx.setTheme(s.theme), {
            swatchColor: s.color,
            right: ctx.theme === s.theme ? '●' : '',
          })
        ),
        createNavRow('iPod Finish', () => ctx.nav.push({ type: 'settings', section: 'finish', highlight: 0 }), {
          sub: finishLabel(ctx.ipod.finishId),
          swatchColor: ctx.ipod.faceplate,
        }),
        createNavRow('Reset iPod Finish', () => {
          ctx.resetIpodFinish();
          ctx.toast('iPod finish reset', 'info');
        }),
      ];
    case 'finish':
      return IPOD_FINISHES.map((f) =>
        createNavRow(f.label, () => {
          ctx.setIpodFinish(f.id);
        }, {
          swatchColor: f.faceplate,
          right: ctx.ipod.finishId === f.id ? '●' : '',
        })
      );
    case 'audio':
      return [
        createNavRow('Equalizer', () => ctx.nav.push({ type: 'settings', section: 'eq', highlight: 0 })),
        createNavRow('Audio Effects', () => ctx.nav.push({ type: 'settings', section: 'audiofx', highlight: 0 })),
        createNavRow('Crossfade', () => ctx.nav.push({ type: 'settings', section: 'crossfade', highlight: 0 }), {
          sub: ctx.audio.crossfadeEnabled ? `On · ${ctx.audio.crossfadeDuration}s` : `Off${ctx.audio.seamlessEnabled ? ' · Seamless' : ''}`,
        }),
        createNavRow('Sleep Timer', () => ctx.nav.push({ type: 'settings', section: 'sleep', highlight: 0 })),
      ];
    case 'navidrome':
      return [
        createNavRow('Connection', () => ctx.nav.push({ type: 'settings', section: 'navidromeSettings', highlight: 0 })),
        ...ctx.audio.serverConfigs.map((c) =>
          createNavRow(c.name, () => {
            ctx.audio.switchServer(c.id).then(() => ctx.toast(`Switched to ${c.name}`, 'success'));
          }, {
            right: ctx.audio.activeServerConfig?.id === c.id ? '●' : '',
            sub: c.url,
          })
        ),
      ];
    case 'lastfm':
      return ctx.audio.lastFmConnected
        ? [
            createNavRow('Disconnect Last.fm', () => {
              ctx.audio.disconnectLastFm();
              ctx.toast('Last.fm disconnected', 'info');
            }),
          ]
        : [createNavRow('Connect Last.fm', () => ctx.nav.push({ type: 'settings', section: 'lastfmPanel', highlight: 0 }))];
    case 'about':
      return [
        { key: 'version', kind: 'nav', label: 'Version', right: '1.4.0', chevron: false, action: () => {} },
        {
          key: 'github',
          kind: 'nav',
          label: 'Open Source on GitHub',
          action: () => {
            Linking.openURL('https://github.com/graphicsprocessingunit/Coda').catch(() => {});
          },
        },
        { key: 'credit', kind: 'action', label: 'Made with a click wheel', action: () => {} },
      ];
    default:
      return [];
  }
}

function finishLabel(id: string): string {
  return IPOD_FINISHES.find((f) => f.id === id)?.label ?? IPOD_FINISHES[0].label;
}

function navidromeTrackToMetadata(ctx: RowsCtx, song: NavidromeSong): TrackMetadata | null {
  const creds = ctx.audio.getNavidromeCredentials();
  if (!creds) return null;
  return NavidromeService.songToTrackMetadata(creds, song);
}

function buildNavidrome(screen: IpodScreen, ctx: RowsCtx): IpodRow[] {
  const data = ctx.navidromeData[screen.key ?? ''];
  if (screen.view === 'artists') {
    const artists = (data as NavidromeArtist[]) ?? [];
    return maybeEmpty(
      artists.map((a) =>
        createNavRow(a.name, () =>
          ctx.nav.push({ type: 'navidrome', view: 'albums', key: `albums:${a.id}`, artist: a, highlight: 0 })
        , { sub: `${a.albumCount ?? 0} ${(a.albumCount ?? 0) === 1 ? 'album' : 'albums'}` })
      ),
      'No artists found'
    );
  }
  if (screen.view === 'albums') {
    const albums = (data as NavidromeAlbum[]) ?? [];
    return maybeEmpty(
      albums.map((a) =>
        createNavRow(a.name, () =>
          ctx.nav.push({ type: 'navidrome', view: 'songs', key: `songs:${a.id}`, album: a, highlight: 0 })
        , { sub: `${a.songCount ?? 0} songs${a.year ? ` · ${a.year}` : ''}` })
      ),
      'No albums found'
    );
  }
  const songs = (data as NavidromeSong[]) ?? [];
  const albumName = screen.album?.name ?? 'Album';
  return maybeEmpty(
    [
      ...(songs.length > 0
        ? [
            createNavRow('Download All', () => {
              const metas = songs
                .map((s) => navidromeTrackToMetadata(ctx, s))
                .filter((m): m is TrackMetadata => m !== null);
              if (metas.length === 0) return;
              ctx.startBatchDownload(metas, albumName, `module:navidrome:${screen.key ?? albumName}`);
              ctx.toast('Downloading album…', 'info');
            }),
          ]
        : []),
      ...songs.map((s) => {
        const meta = navidromeTrackToMetadata(ctx, s);
        return createTrackRow(
          `nsong:${s.id}`,
          meta ?? { title: s.title, artist: s.artist || 'Unknown Artist', uri: `navidrome:${s.id}`, duration: s.duration },
          () => {
            if (!meta) return;
            ctx.audio.addToLibrary([meta]);
            ctx.audio.playFromLibrary(meta).catch((e) => ctx.toast(`Playback failed: ${e?.message ?? e}`, 'error'));
          },
          ctx,
          { longPress: () => meta && showTrackActions(ctx, meta) }
        );
      }),
    ],
    'No songs found'
  );
}

export function screenTitle(screen: IpodScreen): string {
  switch (screen.type) {
    case 'root':
      return 'iPod';
    case 'music':
      return 'Music';
    case 'nowplaying':
      return 'Now Playing';
    case 'tracks':
      return screen.title ?? 'Tracks';
    case 'artists':
      return 'Artists';
    case 'albums':
      return 'Albums';
    case 'smart':
      return 'Smart Playlists';
    case 'playlists':
      return 'Playlists';
    case 'playlist':
      return 'Playlist';
    case 'reorder':
      return 'Reorder Tracks';
    case 'search':
      return 'Search';
    case 'pickPlaylist':
      return 'Add to Playlist';
    case 'settings':
      return `${screen.section === 'root' ? 'iPod' : screen.section!.charAt(0).toUpperCase() + screen.section!.slice(1)} Settings`;
    case 'navidrome':
      return screen.view === 'artists'
        ? 'Navidrome'
        : screen.view === 'albums'
        ? (screen.artist?.name ?? 'Albums')
        : (screen.album?.name ?? 'Songs');
    default:
      return 'iPod';
  }
}