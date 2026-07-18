import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackMetadata, Playlist } from '../context/AudioContext';
import { StorageService } from './StorageService';

const LYRICS_CACHE_PREFIX = '@coda_lyrics_';

interface DemoTrack extends TrackMetadata {
  playCount: number;
}

const DEMO_TRACKS: DemoTrack[] = [
  {
    title: 'Sunrise Melody',
    artist: 'Aether Collective',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    artwork: 'https://picsum.photos/seed/sunrise/400/400',
    album: 'Dawn',
    source: 'local',
    isFavorite: true,
    playCount: 12,
  },
  {
    title: 'Midnight Drive',
    artist: 'Neon Drift',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    artwork: 'https://picsum.photos/seed/midnight/400/400',
    album: 'After Hours',
    source: 'local',
    playCount: 8,
  },
  {
    title: 'Ocean Waves',
    artist: 'Tidal Sounds',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    artwork: 'https://picsum.photos/seed/ocean/400/400',
    album: 'Blue Horizons',
    source: 'local',
    playCount: 15,
  },
  {
    title: 'City Lights',
    artist: 'Urban Echo',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    artwork: 'https://picsum.photos/seed/citylights/400/400',
    album: 'Metropolis',
    source: 'local',
    isFavorite: true,
    playCount: 23,
  },
  {
    title: 'Forest Rain',
    artist: "Nature's Canvas",
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    artwork: 'https://picsum.photos/seed/forest/400/400',
    album: 'Earth Tones',
    source: 'local',
    playCount: 5,
  },
  {
    title: 'Starlight',
    artist: 'Cosmos',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    artwork: 'https://picsum.photos/seed/starlight/400/400',
    album: 'Nebula',
    source: 'local',
    isFavorite: true,
    playCount: 18,
  },
  {
    title: 'Desert Wind',
    artist: 'Sandstorm',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    artwork: 'https://picsum.photos/seed/desert/400/400',
    album: 'Dunes',
    source: 'local',
    playCount: 3,
  },
  {
    title: 'Electric Dreams',
    artist: 'Synthwave FM',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    artwork: 'https://picsum.photos/seed/electric/400/400',
    album: 'Retro Future',
    source: 'local',
    playCount: 31,
  },
  {
    title: 'Gentle Breeze',
    artist: 'Calm Collective',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    artwork: 'https://picsum.photos/seed/breeze/400/400',
    album: 'Stillness',
    source: 'local',
    playCount: 7,
  },
  {
    title: 'Neon Glow',
    artist: 'Pixel Hearts',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    artwork: 'https://picsum.photos/seed/neon/400/400',
    album: 'Synthwave Nights',
    source: 'local',
    playCount: 11,
  },
];

const SUNRISE_LYRICS = `[00:00.00]Sunrise Melody
[00:04.50]Aether Collective
[00:08.00]
[00:12.00]Golden light breaks through the haze
[00:18.50]Warming up these empty days
[00:25.00]Every note a gentle wave
[00:31.50]Drifting through the morning grave
[00:38.00]
[00:42.00]Melodies like painted skies
[00:48.50]Echoes where the silence lies
[00:55.00]Hold this moment let it bloom
[01:01.50]Music fills the open room
[01:08.00]
[01:15.00]Sunrise melody carry me away
[01:21.50]Into the light of a brand new day
[01:28.00]Every sound a gentle prayer
[01:34.50]Music lifting through the air
[01:41.00]
[01:48.00]Open skies and painted gold
[01:54.50]Stories that the morning told
[02:01.00]Rhythms flowing like the tide
[02:07.50]Nowhere left to run or hide
[02:14.00]
[02:21.00]Sunrise melody carry me away
[02:27.50]Into the light of a brand new day`;

const OCEAN_LYRICS = `[00:00.00]Ocean Waves
[00:04.50]Tidal Sounds
[00:08.00]
[00:12.00]Rolling in from distant shores
[00:18.50]Breaking on the sandy floors
[00:25.00]Whispers carried on the breeze
[00:31.50]Dancing through the ancient trees
[00:38.00]
[00:42.00]Salt and sky and endless blue
[00:48.50]Every wave a song anew
[00:55.00]Let the current pull you in
[01:01.50]Where the ocean dreams begin
[01:08.00]
[01:15.00]Ocean waves are calling out my name
[01:21.50]Riding on the tide without no shame
[01:28.00]Deep blue secrets whispered low
[01:34.50]Watch the evening sunset glow
[01:41.00]
[01:48.00]Footprints fading in the sand
[01:54.50]Seashells scattered by my hand
[02:01.00]Horizon stretching wide and far
[02:07.50]Every setting sun a star
[02:14.00]
[02:21.00]Ocean waves are calling out my name`;

export async function loadDemoContent(
  setLibrary: (tracks: TrackMetadata[]) => void
): Promise<void> {
  const tracks: TrackMetadata[] = DEMO_TRACKS.map(({ playCount: _pc, ...track }) => track);

  await StorageService.saveLibrary(tracks);
  setLibrary(tracks);

  const playlists: Playlist[] = [
    {
      id: 'demo-chill',
      name: 'Chill Vibes',
      tracks: [tracks[0], tracks[2], tracks[4], tracks[8]],
      createdAt: Date.now(),
    },
    {
      id: 'demo-drive',
      name: 'Late Night Drive',
      tracks: [tracks[1], tracks[3], tracks[7], tracks[9]],
      createdAt: Date.now() - 1000,
    },
  ];

  await StorageService.savePlaylists(playlists);
  await StorageService.saveCurrentTrack(tracks[0]);
  await StorageService.savePlaybackPosition(0);
  await StorageService.saveQueue([]);

  await AsyncStorage.setItem(
    `${LYRICS_CACHE_PREFIX}Aether Collective::Sunrise Melody`,
    SUNRISE_LYRICS
  );
  await AsyncStorage.setItem(
    `${LYRICS_CACHE_PREFIX}Tidal Sounds::Ocean Waves`,
    OCEAN_LYRICS
  );
}
