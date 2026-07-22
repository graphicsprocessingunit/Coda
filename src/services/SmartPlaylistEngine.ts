import { TrackMetadata, SmartPlaylist, SmartPlaylistRule } from '../context/AudioContext';

export function evaluateSmartPlaylist(
  library: TrackMetadata[],
  playlist: SmartPlaylist
): TrackMetadata[] {
  let result = library.filter(track =>
    playlist.rules.every(rule => evaluateRule(track, rule))
  );

  const sortField = playlist.sortField || 'title';
  const sortDir = playlist.sortDirection || (sortField === 'playCount' ? 'desc' : 'asc');

  result.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'playCount') {
      cmp = (a.playCount || 0) - (b.playCount || 0);
    } else {
      cmp = a.title.localeCompare(b.title);
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const limit = playlist.limit ?? 50;
  return result.slice(0, limit);
}

function evaluateRule(track: TrackMetadata, rule: SmartPlaylistRule): boolean {
  switch (rule.field) {
    case 'playCount': {
      const val = track.playCount || 0;
      switch (rule.op) {
        case 'gte': return val >= rule.value;
        case 'lte': return val <= rule.value;
        case 'eq': return val === rule.value;
      }
      return true;
    }
    case 'isFavorite':
      return (track.isFavorite || false) === rule.value;
    case 'artist': {
      const artist = (track.artist || '').toLowerCase();
      const val = rule.value.toLowerCase();
      if (rule.op === 'contains') return artist.includes(val);
      return artist === val;
    }
    case 'album': {
      const album = (track.album || '').toLowerCase();
      const val = rule.value.toLowerCase();
      if (rule.op === 'contains') return album.includes(val);
      return album === val;
    }
    case 'source':
      return track.source === rule.value;
    default:
      return true;
  }
}
