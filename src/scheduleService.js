import ical from 'node-ical';

const CAL_URL =
  'https://ics.ecal.com/ecal-sub/660897ca63f9ca0008bcbea6/Formula%201.ics';

// In-memory cache: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;
let cachedSchedule = null;
let lastFetchTime = 0;

/**
 * Parses event summary into Round Name and Session Kind
 * e.g. "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Practice 1"
 */
function parseEventName(fullName) {
  if (!fullName) return null;
  const match = fullName.match(/FORMULA 1 (.+?\d{4})\s*(?:-|\u2013)\s*(.+)/i);
  if (!match) return null;
  return {
    roundName: match[1].trim(),
    sessionKind: match[2].trim(),
  };
}

/**
 * Fetch and parse official F1 ICS calendar
 * Returns list of Grand Prix rounds with their sessions
 */
export async function getSchedule(targetYear = new Date().getFullYear()) {
  const now = Date.now();
  if (cachedSchedule && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedSchedule;
  }

  try {
    const events = await ical.async.fromURL(CAL_URL);
    const roundsMap = new Map();

    for (const key of Object.keys(events)) {
      const ev = events[key];
      if (ev.type !== 'VEVENT' || !ev.summary) continue;

      const parsed = parseEventName(ev.summary);
      if (!parsed) continue;

      const { roundName, sessionKind } = parsed;
      const start = new Date(ev.start);
      const end = new Date(ev.end);

      // Filter by target year (allow weekend bridging Dec-Jan if needed)
      if (start.getFullYear() !== targetYear && end.getFullYear() !== targetYear) {
        continue;
      }

      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, {
          name: roundName,
          countryName: ev.location || 'Unknown',
          countryKey: null,
          start,
          end,
          sessions: [],
          over: false,
        });
      }

      const round = roundsMap.get(roundName);
      round.sessions.push({
        kind: sessionKind,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (start < round.start) round.start = start;
      if (end > round.end) round.end = end;
    }

    const nowDate = new Date();
    const rounds = Array.from(roundsMap.values())
      .map((r) => ({
        ...r,
        start: r.start.toISOString(),
        end: r.end.toISOString(),
        over: r.end < nowDate,
        sessions: r.sessions.sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        ),
      }))
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

    cachedSchedule = rounds;
    lastFetchTime = now;
    return rounds;
  } catch (err) {
    console.error('Failed to fetch/parse F1 calendar:', err);
    // If cache exists even if expired, return it as fallback
    if (cachedSchedule) return cachedSchedule;
    throw err;
  }
}

/**
 * Returns the next upcoming round, or null if season is over
 */
export async function getNextRace() {
  const schedule = await getSchedule();
  const next = schedule.find((r) => !r.over);
  return next || null;
}

/**
 * Returns the exact NEXT upcoming session (FP1, FP2, FP3, Sprint, Qualifying, or Race)
 */
export async function getNextSession() {
  const schedule = await getSchedule();
  const now = new Date();

  let nextSession = null;
  let nextRound = null;

  for (const round of schedule) {
    for (const sess of round.sessions) {
      const sessEnd = new Date(sess.end);
      if (sessEnd > now) {
        if (!nextSession || new Date(sess.start) < new Date(nextSession.start)) {
          nextSession = sess;
          nextRound = round;
        }
      }
    }
  }

  if (!nextSession || !nextRound) return null;

  const startTime = new Date(nextSession.start);
  const endTime = new Date(nextSession.end);
  const isLive = now >= startTime && now <= endTime;
  const msUntilStart = startTime - now;

  return {
    round: nextRound,
    session: nextSession,
    isLive,
    startTime,
    endTime,
    msUntilStart,
    unixTimestamp: Math.floor(startTime.getTime() / 1000),
  };
}

/**
 * Format ISO date string into Vietnam Time (GMT+7)
 * e.g. "19:00 (CN, 11/10/2026) [GMT+7]"
 */
export function formatVietnamTime(isoDate) {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    const timeStr = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const dateStr = d.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    return `${timeStr} (${dateStr}) [GMT+7]`;
  } catch {
    return isoDate;
  }
}
