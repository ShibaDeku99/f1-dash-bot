import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID, // optional, dev only
  },
  urls: {
    live: process.env.LIVE_URL || 'http://localhost:4000',
    api: process.env.API_URL || 'http://localhost:4010',
  },
  channels: {
    raceControl: process.env.RACE_CONTROL_CHANNEL_ID,
    liveLeaderboard: process.env.LIVE_LEADERBOARD_CHANNEL_ID,
    teamRadio: process.env.TEAM_RADIO_CHANNEL_ID,
    sessionAlert: process.env.SESSION_ALERT_CHANNEL_ID,
  },
};

// Validate required config
const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
