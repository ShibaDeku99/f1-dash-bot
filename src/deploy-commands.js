import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { config } from './config.js';

import * as leaderboard from './commands/leaderboard.js';
import * as livetiming from './commands/livetiming.js';
import * as countdown from './commands/countdown.js';
import * as standings from './commands/standings.js';
import * as championship from './commands/championship.js';
import * as driver from './commands/driver.js';
import * as tire from './commands/tire.js';
import * as session from './commands/session.js';
import * as weather from './commands/weather.js';
import * as trackStatus from './commands/track-status.js';
import * as top3 from './commands/top3.js';
import * as nextRace from './commands/next-race.js';
import * as schedule from './commands/schedule.js';
import * as status from './commands/status.js';

const commands = [
  leaderboard.data,
  livetiming.data,
  countdown.data,
  standings.data,
  championship.data,
  driver.data,
  tire.data,
  session.data,
  weather.data,
  trackStatus.data,
  top3.data,
  nextRace.data,
  schedule.data,
  status.data,
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(`📡 Registering ${commands.length} slash commands...`);

    let data;

    if (config.discord.guildId) {
      // Guild-specific (instant, for dev)
      data = await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} commands to guild ${config.discord.guildId}`);
    } else {
      // Global (takes up to 1 hour to propagate)
      data = await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} commands globally`);
    }
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
