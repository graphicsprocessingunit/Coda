/**
 * OpenSubsonic `getLyricsBySongId` returns lyrics in a structured form rather
 * than LRC. Synced entries carry a millisecond start for every line; unsynced
 * ones are just text. Convert them into the format the player already parses.
 */

export interface StructuredLyricLine {
  start?: number;
  value: string;
}

export interface StructuredLyricsPayload {
  synced?: boolean;
  line?: StructuredLyricLine[];
}

export interface ChosenLyrics {
  lyrics: string;
  synced: boolean;
}

function normalizeLines(lines: unknown): StructuredLyricLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => line as StructuredLyricLine)
    .filter(
      (line): line is StructuredLyricLine =>
        !!line && typeof line.value === 'string' && line.value.trim().length > 0
    )
    .map((line) => ({ start: line.start, value: line.value.replace(/\r/g, '').trimEnd() }));
}

function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    millis
  ).padStart(3, '0')}]`;
}

export function structuredLyricsToLrc(lines: readonly StructuredLyricLine[]): string {
  return lines.map((line) => `${formatTimestamp(line.start ?? 0)}${line.value}`).join('\n');
}

/**
 * Pick the best structured entry: a fully timed one if the server has it,
 * otherwise the first entry's text. Returns null when there are no lines.
 */
export function chooseStructuredLyrics(entries: unknown): ChosenLyrics | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const parsed = entries
    .map((entry) => entry as StructuredLyricsPayload)
    .map((entry) => ({ entry, lines: normalizeLines(entry?.line) }))
    .filter(({ lines }) => lines.length > 0);

  if (parsed.length === 0) return null;

  const timed = parsed.find(
    ({ entry, lines }) =>
      entry.synced !== false && lines.every((line) => typeof line.start === 'number')
  );
  if (timed) {
    return { lyrics: structuredLyricsToLrc(timed.lines), synced: true };
  }

  return { lyrics: parsed[0].lines.map((line) => line.value).join('\n'), synced: false };
}
