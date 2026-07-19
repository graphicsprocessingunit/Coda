# Coda V2 Beta Testing Checklist

Test on a physical device (not simulator). Free Apple ID → IPA expires after 7 days.

---

## Setup

- [ ] Install IPA via SideStore/AltStore
- [ ] Grant notification + media permissions
- [ ] App launches without crash

## Core Playback

- [ ] Play a local track — artwork, title, artist display
- [ ] Pause / resume works
- [ ] Skip next / skip previous
- [ ] Seek via progress bar
- [ ] Lock screen controls (play, pause, skip, seek)
- [ ] Background playback continues when app is backgrounded

## Library

- [ ] Import audio files via file picker
- [ ] Search filters tracks by title/artist
- [ ] Sort by title vs play count
- [ ] Favorites filter tab shows only favorited tracks
- [ ] Downloads filter tab shows cached tracks
- [ ] Play count increments on each play
- [ ] Song Info (long-press → Song Info) shows metadata + artwork

## Playlists

- [ ] Create a playlist
- [ ] Add tracks from Library (long-press → Add to Playlist)
- [ ] Add tracks from within playlist (Add button)
- [ ] Drag to reorder tracks
- [ ] Swipe to remove tracks
- [ ] Play playlist loads all tracks into queue
- [ ] Rename playlist
- [ ] Delete playlist

## Smart Playlists

- [ ] Create a smart playlist with a rule (e.g., playCount >= 3)
- [ ] Rule builder shows field/operator/value inputs
- [ ] Sort and limit options work
- [ ] Opening smart playlist shows computed tracks
- [ ] Rule chips display correctly
- [ ] Play button plays computed tracks
- [ ] Long-press to delete smart playlist

## Queue

- [ ] Queue icon opens queue view
- [ ] Drag to reorder tracks in queue
- [ ] Swipe to remove tracks from queue
- [ ] Shuffle randomizes queue (Fisher-Yates)
- [ ] Repeat all / repeat one / repeat off
- [ ] Add from library search in queue
- [ ] Clear queue button works

## Batch Operations

- [ ] Long-press a track enters selection mode
- [ ] Tap tracks to toggle selection (checkmark UI)
- [ ] Select All / Select None / Done header works
- [ ] Batch favorite (heart icon) toggles all selected
- [ ] Batch add-to-playlist opens playlist picker
- [ ] Batch download starts downloads for selected
- [ ] Batch delete shows confirmation, removes tracks
- [ ] Selection mode works in PlaylistDetail
- [ ] Selection mode works in Queue

## Crossfade & Seamless

- [ ] Enable crossfade (1-12 seconds) — tracks overlap smoothly
- [ ] Enable seamless — crossfade auto-sets to 2s
- [ ] Disable seamless — crossfade retains previous value

## Sleep Timer

- [ ] Set sleep timer — playback stops after duration
- [ ] Fade out in last 30 seconds (volume ramps down)
- [ ] Cancel sleep timer

## Audio Effects

- [ ] Adjust playback speed (0.5x - 2.0x)
- [ ] Adjust volume
- [ ] Apply a preset (e.g., Podcast, Bass Boost)

## Lyrics

- [ ] Synced lyrics scroll and highlight
- [ ] Tap a line to seek to that time
- [ ] Manual lyrics display if no LRCLIB match

## Themes

- [ ] Dark theme (default)
- [ ] Light theme — status bar switches to dark
- [ ] Midnight theme
- [ ] Ocean theme
- [ ] Theme persists across app restarts

## Navidrome

- [ ] Enter server URL, username, password → Connect succeeds
- [ ] Browse artists/albums/tracks
- [ ] Search within Navidrome browser
- [ ] Stream a track
- [ ] Add track to library (auto-downloads)
- [ ] Add album to library
- [ ] Download for Offline (long-press)
- [ ] Disconnect removes credentials

## Last.fm

- [ ] Get API key + shared secret from last.fm/api
- [ ] Settings → Last.fm → Enter credentials → Get Token → Authorize → Connect
- [ ] "Scrobbling" indicator appears on Player
- [ ] Red dot indicator on Settings row when connected
- [ ] Scrobble submits after min(240s, half duration)
- [ ] Now-playing update fires on track load
- [ ] Disconnect clears credentials

## Offline

- [ ] Download tracks via Navidrome browser
- [ ] Downloaded tracks play without network
- [ ] Cached artwork displays
- [ ] Clear cache removes downloaded files

## Edge Cases

- [ ] Rapid track skipping (no crash, no overlap)
- [ ] Empty library state shows helpful message
- [ ] Empty playlist state shows helpful message
- [ ] No network → Navidrome shows error gracefully
- [ ] App backgrounded during playback → resumes correctly
- [ ] Import large batch of files (10+) → no crash

---

**Device:** _______________  
**OS Version:** _______________  
**Date:** _______________  
**Tester:** _______________
