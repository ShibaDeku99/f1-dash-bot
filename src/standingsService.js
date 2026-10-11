import { f1State } from './state.js';

let cachedStaticStandings = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

// Default team colours in case driverList is not yet loaded
const TEAM_COLOR_MAP = {
  mercedes: '#00D7B6',
  ferrari: '#ED1131',
  mclaren: '#F47600',
  red_bull: '#4781D7',
  aston_martin: '#229971',
  alpine: '#00A1E8',
  haas: '#B6BABD',
  rb: '#6C98FF',
  racing_bulls: '#6C98FF',
  sauber: '#52E252',
  williams: '#64C4FF',
};

/**
 * Fetch latest official championship standings
 * Priority 1: In-memory live prediction if active race
 * Priority 2: In-memory cache if fresh
 * Priority 3: Jolpica Ergast API (24/7 official FIA championship data, no 403 blocks)
 * Priority 4: F1 static CDN archive (with browser User-Agent headers)
 */
export async function getStandings() {
  // 1. If live race has ChampionshipPrediction in memory, use live data
  const livePrediction = f1State.championshipPrediction;
  if (livePrediction?.Drivers && Object.keys(livePrediction.Drivers).length > 0) {
    return formatStandingsData(livePrediction, true, f1State.sessionInfo?.Meeting?.Name || 'Live Race');
  }

  // 2. Use cached static standings if fresh
  const now = Date.now();
  if (cachedStaticStandings && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedStaticStandings;
  }

  // 3. Primary provider: Jolpica Ergast API
  try {
    const formatted = await fetchJolpicaStandings();
    if (formatted?.drivers?.length) {
      cachedStaticStandings = formatted;
      lastCacheTime = now;
      return formatted;
    }
  } catch (err) {
    console.warn('⚠️ Jolpica API unavailable, trying F1 static archive:', err.message);
  }

  // 4. Fallback provider: F1 static archive with browser headers
  try {
    const formatted = await fetchF1StaticStandings();
    if (formatted?.drivers?.length) {
      cachedStaticStandings = formatted;
      lastCacheTime = now;
      return formatted;
    }
  } catch (err) {
    console.warn('⚠️ F1 static archive unavailable:', err.message);
  }

  // 5. If we have any older cache, return it
  if (cachedStaticStandings) {
    return cachedStaticStandings;
  }

  throw new Error('Unable to load championship standings from any provider at this moment.');
}

/**
 * Fetch official standings from Jolpica Ergast API
 */
async function fetchJolpicaStandings() {
  const headers = {
    'User-Agent': 'f1-dash-bot/1.0 (Discord F1 Telemetry Bot)',
    'Accept': 'application/json',
  };

  const [dRes, cRes] = await Promise.all([
    fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json', { headers }),
    fetch('https://api.jolpi.ca/ergast/f1/current/constructorstandings.json', { headers }),
  ]);

  if (!dRes.ok || !cRes.ok) {
    throw new Error(`Jolpica returned status ${dRes.status}/${cRes.status}`);
  }

  const [dData, cData] = await Promise.all([dRes.json(), cRes.json()]);

  const dList = dData?.MRData?.StandingsTable?.StandingsLists?.[0];
  const cList = cData?.MRData?.StandingsTable?.StandingsLists?.[0];

  if (!dList?.DriverStandings?.length) {
    throw new Error('No driver standings found in Jolpica response');
  }

  const seasonYear = dList.season || new Date().getFullYear();
  const driverList = f1State.driverList || {};

  const drivers = dList.DriverStandings.map((d) => {
    const num = d.Driver.permanentNumber || '';
    const tla = d.Driver.code || d.Driver.familyName.slice(0, 3).toUpperCase();
    const teamName = d.Constructors?.[0]?.name || 'Unknown Team';
    const teamId = (d.Constructors?.[0]?.constructorId || '').toLowerCase().replace(/-/g, '_');

    // Enrich from f1State.driverList if matching
    const f1Driver =
      (num && driverList[num]) ||
      Object.values(driverList).find((dl) => dl.Tla === tla);

    const teamColour = f1Driver?.TeamColour
      ? `#${f1Driver.TeamColour.replace('#', '')}`
      : TEAM_COLOR_MAP[teamId] || '#E10600';

    return {
      position: parseInt(d.position),
      racingNumber: num || tla,
      tla,
      fullName: `${d.Driver.givenName || ''} ${d.Driver.familyName || ''}`.trim(),
      teamName,
      teamColour,
      headshotUrl: f1Driver?.HeadshotUrl || null,
      points: parseFloat(d.points || 0),
      currentPoints: parseFloat(d.points || 0),
      posDiff: 0,
    };
  });

  const teams = (cList?.ConstructorStandings || []).map((t) => ({
    position: parseInt(t.position),
    teamName: t.Constructor.name,
    points: parseFloat(t.points || 0),
    currentPoints: parseFloat(t.points || 0),
  }));

  return {
    drivers,
    teams,
    isLive: false,
    sessionName: `World Championship ${seasonYear}`,
  };
}

/**
 * Fallback to F1 static CDN archive with browser User-Agent
 */
async function fetchF1StaticStandings() {
  const currentYear = new Date().getFullYear();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };

  const indexRes = await fetch(`https://livetiming.formula1.com/static/${currentYear}/Index.json`, { headers });
  if (!indexRes.ok) throw new Error(`Index.json returned ${indexRes.status}`);

  const indexData = await indexRes.json();
  let latestPath = null;
  let meetingName = 'World Championship';

  for (let i = indexData.Meetings.length - 1; i >= 0; i--) {
    const meeting = indexData.Meetings[i];
    const race = meeting.Sessions?.find((s) => s.Type === 'Race' && s.Path);
    if (race) {
      latestPath = race.Path;
      meetingName = meeting.Name;
      break;
    }
  }

  if (!latestPath) throw new Error('No completed race session found in Index.json');

  const champRes = await fetch(`https://livetiming.formula1.com/static/${latestPath}ChampionshipPrediction.json`, { headers });
  if (!champRes.ok) throw new Error(`ChampionshipPrediction.json returned ${champRes.status}`);

  const champData = await champRes.json();
  return formatStandingsData(champData, false, meetingName);
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
    .sort((a, b) => (a.PredictedPosition || a.CurrentPosition) - (b.CurrentPosition || b.PredictedPosition))
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
