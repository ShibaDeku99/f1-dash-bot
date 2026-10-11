import 'dotenv/config';

// Automatically decode Client ID from Token if not explicitly provided
let clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId && process.env.DISCORD_TOKEN) {
  try {
    const raw = process.env.DISCORD_TOKEN.split('.')[0];
    const decoded = Buffer.from(raw, 'base64').toString('ascii');
    if (/^\d+$/.test(decoded)) {
      clientId = decoded;
    }
  } catch {}
}
if (!clientId) {
  clientId = '1558610404362682378'; // Fallback
}

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId,
    guildId: process.env.DISCORD_GUILD_ID || '1548453648999383151',
  },
  urls: {
    live: process.env.LIVE_URL || 'http://localhost:4000',
    api: process.env.API_URL || 'http://localhost:4010',
  },
  channels: {
    raceControl: process.env.RACE_CONTROL_CHANNEL_ID || '1548453650727174198',
    liveLeaderboard: process.env.LIVE_LEADERBOARD_CHANNEL_ID || '1548453650727174198',
    teamRadio: process.env.TEAM_RADIO_CHANNEL_ID || '1548453650727174198',
    sessionAlert: process.env.SESSION_ALERT_CHANNEL_ID || '1548453650727174198',
  },
};

// Validate required token
if (!config.discord.token) {
  console.error('❌ Missing required environment variable: DISCORD_TOKEN');
  process.exit(1);
}
