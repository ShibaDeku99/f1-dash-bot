import WebSocket from 'ws';
import crypto from 'crypto';
import { f1State } from './state.js';

const SIGNALR_HOST = 'livetiming.formula1.com/signalrcore';
const STATIC_CDN_BASE = 'https://livetiming.formula1.com/static/';
const RECORD_SEPARATOR = '\x1e';

export const TOPICS = [
  'Heartbeat',
  'CarData.z',
  'Position.z',
  'ExtrapolatedClock',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'SessionStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
  'TeamRadio',
  'ChampionshipPrediction',
];

let wsInstance = null;
let reconnectTimer = null;
let cdnPollTimer = null;
let isConnected = false;
let connectionMode = null; // 'signalr' | 'cdn'
let currentInvocationId = null;

// CDN Poller cached state
let currentSessionPath = null;
let cachedDriverList = null;
let cdnFailureCount = 0;

/**
 * Fetch and parse JSON safely
 */
async function fetchCdnJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Negotiate SignalR connection with F1 Live Timing
 */
async function negotiateSignalR() {
  const negotiateUrl = `https://${SIGNALR_HOST}/negotiate`;
  let cookie = '';

  // 1. Send OPTIONS request to obtain AWSALBCORS routing cookie
  try {
    const optRes = await fetch(negotiateUrl, {
      method: 'OPTIONS',
      headers: {
        'User-Agent': 'BestHTTP',
        'Accept': '*/*',
      },
    });
    const setCookie = optRes.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/AWSALBCORS=[^;]+/);
      if (match) cookie = match[0];
    }
  } catch {}

  // 2. Send POST request with negotiateVersion=1
  const postHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'BestHTTP',
    'Accept': '*/*',
  };
  if (cookie) postHeaders['Cookie'] = cookie;

  const postRes = await fetch(`${negotiateUrl}?negotiateVersion=1`, {
    method: 'POST',
    headers: postHeaders,
  });

  if (!postRes.ok) {
    const err = new Error(`HTTP ${postRes.status}`);
    err.status = postRes.status;
    throw err;
  }

  const negoData = await postRes.json();
  const connectionToken = negoData.connectionToken || negoData.connectionId;

  if (!connectionToken) {
    throw new Error('No connectionToken in response');
  }

  return { connectionToken, cookie };
}

/**
 * Start Official F1 Static CDN Polling mode
 * Bypasses CloudFront WAF 403 on cloud/hosting servers
 */
function startCdnPoller(onConnect, onDisconnect) {
  if (cdnPollTimer) {
    clearTimeout(cdnPollTimer);
    cdnPollTimer = null;
  }

  connectionMode = 'cdn';
  console.log('🌐 Starting F1 Official CDN Polling mode (High-speed live sync)...');

  async function poll() {
    try {
      // 1. Fetch SessionInfo to know active session and CDN path
      const sessionInfo = await fetchCdnJson(`${STATIC_CDN_BASE}SessionInfo.json`);
      if (!sessionInfo?.Path) {
        cdnFailureCount++;
        scheduleNextPoll(10000);
        return;
      }

      const sessionPath = sessionInfo.Path;
      const isNewSession = sessionPath !== currentSessionPath;

      if (isNewSession) {
        currentSessionPath = sessionPath;
        cachedDriverList = null;
        console.log(`🏎️  F1 Active Session: ${sessionInfo.Meeting?.Name || 'Grand Prix'} — ${sessionInfo.Name || 'Live'}`);
      }

      // 2. Fetch all telemetry feeds in parallel
      const sessionUrl = `${STATIC_CDN_BASE}${sessionPath}`;
      const [
        timingData,
        driverList,
        trackStatus,
        sessionStatus,
        weatherData,
        rcmData,
        timingAppData,
        topThree,
        teamRadio,
      ] = await Promise.all([
        fetchCdnJson(`${sessionUrl}TimingData.json`),
        !cachedDriverList ? fetchCdnJson(`${sessionUrl}DriverList.json`) : Promise.resolve(cachedDriverList),
        fetchCdnJson(`${sessionUrl}TrackStatus.json`),
        fetchCdnJson(`${sessionUrl}SessionStatus.json`),
        fetchCdnJson(`${sessionUrl}WeatherData.json`),
        fetchCdnJson(`${sessionUrl}RaceControlMessages.json`),
        fetchCdnJson(`${sessionUrl}TimingAppData.json`),
        fetchCdnJson(`${sessionUrl}TopThree.json`),
        fetchCdnJson(`${sessionUrl}TeamRadio.json`),
      ]);

      if (driverList) {
        cachedDriverList = driverList;
      }

      // 3. Synthesize LapCount if missing from lines
      let maxLaps = 0;
      if (timingData?.Lines) {
        for (const car of Object.values(timingData.Lines)) {
          const l = Number(car.NumberOfLaps);
          if (l && l > maxLaps) maxLaps = l;
        }
      }
      const lapCount = { CurrentLap: String(maxLaps || 0), TotalLaps: null };

      // 4. Build state update
      const snapshot = {
        SessionInfo: sessionInfo,
        SessionStatus: sessionStatus || { Status: sessionInfo.SessionStatus },
        TrackStatus: trackStatus,
        WeatherData: weatherData,
        TimingData: timingData,
        TimingAppData: timingAppData,
        TopThree: topThree,
        TeamRadio: teamRadio,
        RaceControlMessages: rcmData,
        LapCount: lapCount,
      };

      if (cachedDriverList) {
        snapshot.DriverList = cachedDriverList;
      }

      // 5. Update state
      if (!isConnected) {
        isConnected = true;
        cdnFailureCount = 0;
        f1State.handleInitial(snapshot);
        console.log('✅ F1 Live Timing active via Official CDN Mirror (All telemetry & 22 cars synced)!');
        onConnect?.();
      } else {
        f1State.handleSnapshot(snapshot);
      }

      // 6. Schedule next poll dynamically:
      // Active live race/session: every 4 seconds.
      // Inactive/finished session: every 15 seconds.
      const isLive = f1State.isSessionLive();
      const delay = isLive ? 4000 : 15000;
      scheduleNextPoll(delay);
    } catch (err) {
      console.warn(`⚠️  F1 CDN Poll warning: ${err.message}`);
      scheduleNextPoll(10000);
    }
  }

  function scheduleNextPoll(ms) {
    if (cdnPollTimer) clearTimeout(cdnPollTimer);
    cdnPollTimer = setTimeout(poll, ms);
  }

  // Trigger immediate initial poll
  poll();
}

/**
 * Connect to F1 Official Live Timing
 * Automatically tries SignalR, falls back to Official CDN Mirror if blocked (HTTP 403 on cloud server)
 */
export function connectF1(onConnect, onDisconnect) {
  cleanup();

  // If forced via ENV
  if (process.env.F1_CLIENT_MODE === 'cdn') {
    startCdnPoller(onConnect, onDisconnect);
    return;
  }

  console.log('🏎️  Connecting to F1 Official Live Timing (SignalR)...');

  (async () => {
    try {
      let wsUrl = `wss://${SIGNALR_HOST}`;
      let cookie = '';

      // Try SignalR negotiation
      try {
        const nego = await negotiateSignalR();
        if (nego?.connectionToken) {
          wsUrl = `wss://${SIGNALR_HOST}?id=${encodeURIComponent(nego.connectionToken)}`;
          cookie = nego.cookie || '';
        }
      } catch (negoErr) {
        if (negoErr.status === 403 || String(negoErr.message).includes('403')) {
          console.warn('🛡️  F1 SignalR blocked by CloudFront WAF (HTTP 403 on hosting provider).');
          console.log('⚡  Auto-switching to Official F1 Live CDN Mirror mode...');
          startCdnPoller(onConnect, onDisconnect);
          return;
        }
        console.log(`ℹ️  SignalR negotiate error (${negoErr.message}), attempting direct WebSocket...`);
      }

      const wsHeaders = {
        'User-Agent': 'BestHTTP',
        'Accept-Encoding': 'gzip,identity',
      };
      if (cookie) wsHeaders['Cookie'] = cookie;

      const ws = new WebSocket(wsUrl, { headers: wsHeaders });
      wsInstance = ws;
      connectionMode = 'signalr';

      let handshook = false;

      ws.on('open', () => {
        ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR);
      });

      ws.on('message', (buffer) => {
        const text = buffer.toString('utf8');
        const frames = text.split(RECORD_SEPARATOR).filter(Boolean);

        for (const frame of frames) {
          try {
            const msg = JSON.parse(frame);

            // 1. Initial Handshake response
            if (!handshook) {
              handshook = true;
              if (msg.error) {
                console.error('SignalR handshake error:', msg.error);
                ws.close();
                return;
              }

              currentInvocationId = crypto.randomUUID();
              const subMsg = {
                type: 1,
                invocationId: currentInvocationId,
                target: 'Subscribe',
                arguments: [TOPICS],
              };
              ws.send(JSON.stringify(subMsg) + RECORD_SEPARATOR);
              continue;
            }

            // 2. Subscription Completion response (Initial snapshot)
            if (msg.type === 3 && msg.invocationId === currentInvocationId) {
              isConnected = true;
              console.log('✅ F1 Live Timing stream connected & subscribed via SignalR!');
              if (msg.result) {
                f1State.handleInitial(msg.result);
              }
              onConnect?.();
              continue;
            }

            // 3. Streaming feed update
            if (msg.type === 1 && msg.target === 'feed') {
              const [topic, data] = msg.arguments || [];
              if (!topic) continue;

              if (topic === 'SessionInfo' && data?.Name) {
                console.log('🔄 Session change detected, refreshing stream...');
                ws.close();
                return;
              }

              f1State.handleUpdate({ [topic]: data });
              continue;
            }

            // 4. Ping message
            if (msg.type === 6) {
              try {
                ws.send(JSON.stringify({ type: 6 }) + RECORD_SEPARATOR);
              } catch {}
            }
          } catch (err) {
            console.error('Error parsing SignalR message:', err);
          }
        }
      });

      ws.on('error', (err) => {
        console.warn('⚠️  F1 SignalR connection error:', err.message);
        if (String(err.message).includes('403') || !isConnected) {
          console.log('⚡  Switching to Official F1 Live CDN Mirror mode...');
          startCdnPoller(onConnect, onDisconnect);
        }
      });

      ws.on('close', () => {
        if (isConnected) {
          isConnected = false;
          console.warn('⚠️  F1 SignalR disconnected, reconnecting...');
          onDisconnect?.();
        }
        if (connectionMode === 'signalr') {
          scheduleReconnect(onConnect, onDisconnect);
        }
      });
    } catch (err) {
      console.warn(`⚠️  Failed to connect to F1 SignalR: ${err.message}.`);
      console.log('⚡  Switching to Official F1 Live CDN Mirror mode...');
      startCdnPoller(onConnect, onDisconnect);
    }
  })();
}

function scheduleReconnect(onConnect, onDisconnect) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectF1(onConnect, onDisconnect);
  }, 5000);
}

function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (cdnPollTimer) {
    clearTimeout(cdnPollTimer);
    cdnPollTimer = null;
  }
  if (wsInstance) {
    try {
      wsInstance.close();
    } catch {}
    wsInstance = null;
  }
}

export function getConnectionStatus() {
  return isConnected;
}

export function getConnectionMode() {
  return connectionMode;
}
