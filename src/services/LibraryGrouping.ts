import { TrackMetadata } from '../context/AudioContext';

export const UNKNOWN_ALBUM = 'Unknown Album';
export const UNKNOWN_ARTIST = 'Unknown Artist';

export interface AlbumGroup {
  key: string;
  album: string;
  albumArtist: string;
  year?: number;
  artUri?: string;
  tracks: TrackMetadata[];
  trackCount: number;
  totalDuration: number;
}

export interface ArtistGroup {
  key: string;
  artist: string;
  albums: AlbumGroup[];
  tracks: TrackMetadata[];
  trackCount: number;
  artUri?: string;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function albumArtistOf(track: TrackMetadata): string {
  const value = track.albumArtist || track.artist;
  return value && value.trim() ? value.trim() : UNKNOWN_ARTIST;
}

function albumNameOf(track: TrackMetadata): string {
  return track.album && track.album.trim() ? track.album.trim() : UNKNOWN_ALBUM;
}

function compareTracks(a: TrackMetadata, b: TrackMetadata): number {
  const discA = a.discNumber ?? 1;
  const discB = b.discNumber ?? 1;
  if (discA !== discB) return discA - discB;
  const trackA = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
  const trackB = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
  if (trackA !== trackB) return trackA - trackB;
  return a.title.localeCompare(b.title);
}

export function groupIntoAlbums(tracks: TrackMetadata[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();

  for (const track of tracks) {
    const album = albumNameOf(track);
    const albumArtist = albumArtistOf(track);
    const key = `${normalize(album)}::${normalize(albumArtist)}`;

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        album,
        albumArtist,
        year: undefined,
        artUri: undefined,
        tracks: [],
        trackCount: 0,
        totalDuration: 0,
      };
      map.set(key, group);
    }

    group.tracks.push(track);
    if (group.artUri === undefined && track.artwork) group.artUri = track.artwork;
    if (group.year === undefined && typeof track.year === 'number' && track.year > 0) {
      group.year = track.year;
    }
  }

  const groups = Array.from(map.values());
  for (const group of groups) {
    group.tracks.sort(compareTracks);
    group.trackCount = group.tracks.length;
    group.totalDuration = group.tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  }

  groups.sort((a, b) => {
    const byArtist = a.albumArtist.localeCompare(b.albumArtist);
    if (byArtist !== 0) return byArtist;
    return a.album.localeCompare(b.album);
  });

  return groups;
}

export function groupIntoArtists(tracks: TrackMetadata[]): ArtistGroup[] {
  const map = new Map<string, { artist: string; tracks: TrackMetadata[] }>();

  for (const track of tracks) {
    const artist = track.artist && track.artist.trim() ? track.artist.trim() : UNKNOWN_ARTIST;
    const key = normalize(artist);
    let entry = map.get(key);
    if (!entry) {
      entry = { artist, tracks: [] };
      map.set(key, entry);
    }
    entry.tracks.push(track);
  }

  const groups: ArtistGroup[] = Array.from(map.entries()).map(([key, entry]) => {
    const albums = groupIntoAlbums(entry.tracks);
    const artUri = albums.find((a) => a.artUri)?.artUri;
    return {
      key,
      artist: entry.artist,
      albums,
      tracks: entry.tracks,
      trackCount: entry.tracks.length,
      artUri,
    };
  });

  groups.sort((a, b) => {
    if (a.artist === UNKNOWN_ARTIST) return 1;
    if (b.artist === UNKNOWN_ARTIST) return -1;
    return a.artist.localeCompare(b.artist);
  });

  return groups;
}

export interface LibraryIndex {
  albums: AlbumGroup[];
  artists: ArtistGroup[];
}

export function buildLibraryIndex(tracks: TrackMetadata[]): LibraryIndex {
  return {
    albums: groupIntoAlbums(tracks),
    artists: groupIntoArtists(tracks),
  };
}
