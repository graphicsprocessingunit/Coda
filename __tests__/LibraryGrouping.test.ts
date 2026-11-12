import { TrackMetadata } from '../src/context/AudioContext';
import {
  groupIntoAlbums,
  groupIntoArtists,
  buildLibraryIndex,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
} from '../src/services/LibraryGrouping';

function track(partial: Partial<TrackMetadata> & { title: string; artist: string }): TrackMetadata {
  return { uri: `file:///${partial.title}`, ...partial };
}

describe('LibraryGrouping', () => {
  it('groups tracks into albums and sums duration', () => {
    const tracks = [
      track({ title: 'A', artist: 'Radiohead', album: 'Kid A', trackNumber: 2, duration: 1000 }),
      track({ title: 'B', artist: 'Radiohead', album: 'Kid A', trackNumber: 1, duration: 2000 }),
    ];
    const albums = groupIntoAlbums(tracks);
    expect(albums).toHaveLength(1);
    expect(albums[0].album).toBe('Kid A');
    expect(albums[0].trackCount).toBe(2);
    expect(albums[0].totalDuration).toBe(3000);
    expect(albums[0].tracks.map((t) => t.title)).toEqual(['B', 'A']);
  });

  it('orders multi-disc albums by disc then track', () => {
    const tracks = [
      track({ title: 'Disc2T1', artist: 'X', album: 'Live', discNumber: 2, trackNumber: 1 }),
      track({ title: 'Disc1T2', artist: 'X', album: 'Live', discNumber: 1, trackNumber: 2 }),
      track({ title: 'Disc1T1', artist: 'X', album: 'Live', discNumber: 1, trackNumber: 1 }),
    ];
    const albums = groupIntoAlbums(tracks);
    expect(albums[0].tracks.map((t) => t.title)).toEqual(['Disc1T1', 'Disc1T2', 'Disc2T1']);
  });

  it('does not merge duplicate album titles by different artists', () => {
    const tracks = [
      track({ title: 'A', artist: 'Artist One', album: 'Greatest Hits' }),
      track({ title: 'B', artist: 'Artist Two', album: 'Greatest Hits' }),
    ];
    expect(groupIntoAlbums(tracks)).toHaveLength(2);
  });

  it('keeps compilations together by album artist', () => {
    const tracks = [
      track({ title: 'A', artist: 'Song One', album: 'Mix', albumArtist: 'Various Artists' }),
      track({ title: 'B', artist: 'Song Two', album: 'Mix', albumArtist: 'Various Artists' }),
    ];
    const albums = groupIntoAlbums(tracks);
    expect(albums).toHaveLength(1);
    expect(albums[0].trackCount).toBe(2);
  });

  it('falls back to Unknown Album / Unknown Artist', () => {
    const albums = groupIntoAlbums([track({ title: 'A', artist: '' })]);
    expect(albums[0].album).toBe(UNKNOWN_ALBUM);
    expect(albums[0].albumArtist).toBe(UNKNOWN_ARTIST);

    const artists = groupIntoArtists([track({ title: 'A', artist: '   ' })]);
    expect(artists[0].artist).toBe(UNKNOWN_ARTIST);
  });

  it('captures album year and artwork from tracks', () => {
    const albums = groupIntoAlbums([
      track({ title: 'A', artist: 'X', album: 'Y', year: 1999, artwork: 'file:///art.jpg' }),
    ]);
    expect(albums[0].year).toBe(1999);
    expect(albums[0].artUri).toBe('file:///art.jpg');
  });

  it('groups artists with nested albums and tracks', () => {
    const tracks = [
      track({ title: 'A', artist: 'Radiohead', album: 'Kid A', trackNumber: 1 }),
      track({ title: 'B', artist: 'Radiohead', album: 'Amnesiac', trackNumber: 1 }),
      track({ title: 'C', artist: 'Portishead', album: 'Dummy', trackNumber: 1 }),
    ];
    const artists = groupIntoArtists(tracks);
    expect(artists.map((a) => a.artist)).toEqual(['Portishead', 'Radiohead']);
    const radiohead = artists.find((a) => a.artist === 'Radiohead')!;
    expect(radiohead.albums.map((a) => a.album)).toEqual(['Amnesiac', 'Kid A']);
    expect(radiohead.trackCount).toBe(2);
  });

  it('sorts Unknown Artist last', () => {
    const artists = groupIntoArtists([
      track({ title: 'A', artist: '' }),
      track({ title: 'B', artist: 'Adele' }),
    ]);
    expect(artists.map((a) => a.artist)).toEqual(['Adele', UNKNOWN_ARTIST]);
  });

  it('buildLibraryIndex returns albums and artists', () => {
    const index = buildLibraryIndex([track({ title: 'A', artist: 'X', album: 'Y' })]);
    expect(index.albums).toHaveLength(1);
    expect(index.artists).toHaveLength(1);
  });
});
