import { f1State } from './state.js';

let cachedStaticStandings = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch latest official championship standings
 * Falls back to static F1 archive if no live race session is active
 */
export async function getStandings() {
  // 1. If live race has ChampionshipPrediction in memory, use live data
  const livePrediction = f1State.championshipPrediction;
  if (livePrediction?.Drivers) {
    return formatStandingsData(livePrediction, true, f1State.sessionInfo?.Meeting?.Name || 'Live Race');
  }

  // 2. Use cached static standings if fresh
  const now = Date.now();
  if (cachedStaticStandings && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedStaticStandings;
  }

  // 3. Fetch from F1 static archive
  try {
    const currentYear = new Date().getFullYear();
    const indexRes = await fetch(`https://livetiming.formula1.com/static/${currentYear}/Index.json`);
    if (!indexRes.ok) throw new Error(`Index.json returned ${indexRes.status}`);

    const indexData = await indexRes.json();
    let latestPath = null;
    let meetingName = 'World Championship';

    // Search backwards for the most recent session with ChampionshipPrediction
    for (let i = indexData.Meetings.length - 1; i >= 0; i--) {
      const meeting = indexData.Meetings[i];
      // Check Race session first, then Sprint
      const race = meeting.Sessions?.find((s) => s.Type === 'Race' && s.Path);
      if (race) {
        latestPath = race.Path;
        meetingName = meeting.Name;
        break;
      }
    }

    if (!latestPath) {
      throw new Error('No completed race session found in Index.json');
    }

    const champRes = await fetch(`https://livetiming.formula1.com/static/${latestPath}ChampionshipPrediction.json`);
    if (!champRes.ok) throw new Error(`ChampionshipPrediction.json returned ${champRes.status}`);

    const champData = await champRes.json();

    let driversMap = f1State.driverList;
    if (!driversMap || !Object.keys(driversMap).length) {
      try {
        const dlRes = await fetch(`https://livetiming.formula1.com/static/${latestPath}DriverList.json`);
        if (dlRes.ok) driversMap = await dlRes.json();
      } catch {}
    }

    const formatted = formatStandingsData(champData, false, meetingName, driversMap);

    cachedStaticStandings = formatted;
    lastCacheTime = now;
    return formatted;
  } catch (err) {
    console.error('Failed to fetch official standings from F1 static archive:', err);
    if (cachedStaticStandings) return cachedStaticStandings;
    throw err;
  }
}

function formatStandingsData(raw, isLive, sessionName, overrideDriverList) {
  const driverList = overrideDriverList || f1State.driverList || {};

  const drivers = Object.values(raw.Drivers || {})
    .sort((a, b) => (a.PredictedPosition || a.CurrentPosition) - (b.PredictedPosition || b.CurrentPosition))
    .map((d) => {
      const details = driverList[d.RacingNumber];
      return {
        position: d.PredictedPosition || d.CurrentPosition,
        racingNumber: d.RacingNumber,
        tla: details?.Tla || `#${d.RacingNumber}`,
        fullName: details?.FullName || details?.BroadcastName || `Car #${d.RacingNumber}`,
        teamName: details?.TeamName || 'Unknown Team',
        teamColour: details?.TeamColour ? `#${details.TeamColour.replace('#', '')}` : '#E10600',
        headshotUrl: details?.HeadshotUrl || null,
        points: parseFloat(d.PredictedPoints ?? d.CurrentPoints ?? 0),
        currentPoints: parseFloat(d.CurrentPoints ?? 0),
        posDiff: (d.CurrentPosition || 0) - (d.PredictedPosition || 0),
      };
    });

  const teams = Object.values(raw.Teams || {})
    .sort((a, b) => (a.PredictedPosition || a.CurrentPosition) - (b.PredictedPosition || b.CurrentPosition))
    .map((t) => ({
      position: t.PredictedPosition || t.CurrentPosition,
      teamName: t.TeamName,
      points: parseFloat(t.PredictedPoints ?? t.CurrentPoints ?? 0),
      currentPoints: parseFloat(t.CurrentPoints ?? 0),
    }));

  return {
    drivers,
    teams,
    isLive,
    sessionName,
  };
}
