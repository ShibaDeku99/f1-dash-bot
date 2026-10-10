import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from './config.js';
import { connectF1 } from './f1Client.js';

// Commands
import * as leaderboard from './commands/leaderboard.js';
import * as livetiming from './commands/livetiming.js';
import * as countdown from './commands/countdown.js';
import * as standings from './commands/standings.js';
import * as driver from './commands/driver.js';
import * as tire from './commands/tire.js';
import * as session from './commands/session.js';
import * as weather from './commands/weather.js';
import * as trackStatus from './commands/track-status.js';
import * as top3 from './commands/top3.js';
import * as championship from './commands/championship.js';
import * as nextRace from './commands/next-race.js';
import * as schedule from './commands/schedule.js';
import * as status from './commands/status.js';

// Notifications
import { setupRaceControlNotifier } from './notifications/raceControl.js';
import { setupSessionNotifier } from './notifications/sessionAlert.js';
import { setupTeamRadioNotifier } from './notifications/teamRadio.js';
import { setupLiveLeaderboard } from './notifications/liveLeaderboard.js';
import { setupFastestLapNotifier } from './notifications/fastestLap.js';
import { setupPitStopNotifier } from './notifications/pitStop.js';
import { setupRaceReminder } from './notifications/raceReminder.js';

// ── Discord Client ────────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ── Command Registry ──────────────────────────────────────────────────────────

const commands = new Collection();

const allCommands = [
  leaderboard, livetiming, countdown, standings, championship, driver, tire, session, weather,
  trackStatus, top3, nextRace, schedule, status,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

// ── Event Handlers ────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (readyClient) => {
  console.log(`\n🏎️  F1 Dash Bot ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📋 Registered ${commands.size} slash commands`);
  console.log(`🌐 Mode: Standalone Direct F1 Live Timing (No Docker/Rust needed)\n`);

  // Start all notification systems
  setupRaceControlNotifier(client);
  setupSessionNotifier(client);
  setupTeamRadioNotifier(client);
  setupLiveLeaderboard(client);
  setupFastestLapNotifier(client);
  setupPitStopNotifier(client);
  setupRaceReminder(client);

  // Connect directly to F1 Official Live Timing (SignalR)
  connectF1(
    () => console.log('🏎️  F1 Stream: connected and listening for live session data'),
    () => console.log('⚠️  F1 Stream: disconnected, retrying...'),
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);

    const errorMsg = {
      content: '❌ An error occurred while running this command.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMsg).catch(() => {});
    } else {
      await interaction.reply(errorMsg).catch(() => {});
    }
  }
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down F1 Dash Bot...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down F1 Dash Bot...');
  client.destroy();
  process.exit(0);
});

// ── Start ────────────────────────────────────────────────────────────────────

client.login(config.discord.token);
