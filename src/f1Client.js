import WebSocket from 'ws';
import crypto from 'crypto';
import { f1State } from './state.js';

const SIGNALR_HOST = 'livetiming.formula1.com/signalrcore';
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
let isConnected = false;
let currentInvocationId = null;

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
  } catch (err) {
    // Non-fatal
  }

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
    throw new Error(`HTTP ${postRes.status}`);
  }

  const negoData = await postRes.json();
  const connectionToken = negoData.connectionToken || negoData.connectionId;

  if (!connectionToken) {
    throw new Error('No connectionToken in response');
  }

  return { connectionToken, cookie };
}

/**
 * Connect directly to F1 Live Timing SignalR Hub
 */
export function connectF1(onConnect, onDisconnect) {
  if (wsInstance) {
    try {
      wsInstance.close();
    } catch {}
    wsInstance = null;
  }

  console.log('🏎️  Connecting directly to F1 Official Live Timing (SignalR)...');

  (async () => {
    try {
      let wsUrl = `wss://${SIGNALR_HOST}`;
      let cookie = '';

      // Try negotiation, fallback gracefully to direct WebSocket if cloud WAF blocks HTTP POST
      try {
        const nego = await negotiateSignalR();
        if (nego?.connectionToken) {
          wsUrl = `wss://${SIGNALR_HOST}?id=${encodeURIComponent(nego.connectionToken)}`;
          cookie = nego.cookie || '';
        }
      } catch (negoErr) {
        console.log(`ℹ️  SignalR negotiate bypassed (${negoErr.message}), connecting directly via WebSocket...`);
      }

      const wsHeaders = {
        'User-Agent': 'BestHTTP',
        'Accept-Encoding': 'gzip,identity',
      };
      if (cookie) wsHeaders['Cookie'] = cookie;

      const ws = new WebSocket(wsUrl, { headers: wsHeaders });
      wsInstance = ws;

      let handshook = false;

      ws.on('open', () => {
        // Send SignalR protocol handshake
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

              // Handshake complete, send Subscribe invocation
              currentInvocationId = crypto.randomUUID();
              const subMsg = {
                type: 1, // Invocation
                invocationId: currentInvocationId,
                target: 'Subscribe',
                arguments: [TOPICS],
              };
              ws.send(JSON.stringify(subMsg) + RECORD_SEPARATOR);
              continue;
            }

            // 2. Subscription Completion response (Initial state snapshot)
            if (msg.type === 3 && msg.invocationId === currentInvocationId) {
              isConnected = true;
              console.log('✅ F1 Live Timing stream connected & subscribed!');
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

              // If session changed, trigger reconnect to refresh snapshot
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
              // Respond to keepalive ping
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
        console.warn('⚠️  F1 Live Timing connection error:', err.message);
      });

      ws.on('close', () => {
        if (isConnected) {
          isConnected = false;
          console.warn('⚠️  F1 Live Timing disconnected, reconnecting in 5s...');
          onDisconnect?.();
        }
        scheduleReconnect(onConnect, onDisconnect);
      });
    } catch (err) {
      console.warn(`⚠️  Failed to connect to F1 SignalR: ${err.message}. Retrying in 5s...`);
      scheduleReconnect(onConnect, onDisconnect);
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

export function getConnectionStatus() {
  return isConnected;
}
