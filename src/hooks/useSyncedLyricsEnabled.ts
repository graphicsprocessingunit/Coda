import { useEffect, useState } from 'react';

import {
  getSyncedLyricsEnabledSnapshot,
  loadSyncedLyricsEnabled,
  subscribeSyncedLyricsEnabled,
} from '../services/LyricsSettings';

/** Current synced-lyrics preference, kept in sync across screens. */
export function useSyncedLyricsEnabled(): boolean {
  const [enabled, setEnabled] = useState(getSyncedLyricsEnabledSnapshot);

  useEffect(() => {
    let active = true;

    loadSyncedLyricsEnabled().then((value) => {
      if (active) setEnabled(value);
    });

    const unsubscribe = subscribeSyncedLyricsEnabled((value) => setEnabled(value));

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return enabled;
}
