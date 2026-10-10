import { config } from '../config.js';
import { f1State } from '../state.js';
import { baseEmbed, COLORS, teamColor } from '../formatters/utils.js';

/**
 * Fastest Lap notifier
 * Detects when a new overall fastest lap is set and posts an alert
 */
export function setupFastestLapNotifier(client) {
  const channelId = config.channels.raceControl;
  if (!channelId) return;

  let fastestLapHolder = null; // { driverNum, lapTime }

  f1State.on('update', async (state) => {
    const timingData = state?.TimingData;
    const driverList = state?.DriverList;
    if (!timingData?.Lines || !driverList) return;

    for (const [num, td] of Object.entries(timingData.Lines)) {
      if (td.LastLapTime?.OverallFastest && td.LastLapTime?.Value) {
        const lapTime = td.LastLapTime.Value;

        // Skip if same driver + same time
        if (fastestLapHolder?.driverNum === num && fastestLapHolder?.lapTime === lapTime) continue;

        fastestLapHolder = { driverNum: num, lapTime };

        const driver = driverList[num];
        const driverName = driver
          ? `${driver.FullName} (${driver.Tla})`
          : `#${num}`;
        const team = driver?.TeamName ?? '';
        const color = teamColor(driver?.TeamColour);

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        const embed = baseEmbed(`⚡ Fastest Lap — ${driverName}`, color)
          .setDescription(`**${team}** has set the fastest lap!`)
          .addFields(
            { name: '⏱️ Lap Time', value: `\`${lapTime}\``, inline: true },
            { name: '🔢 Car #', value: `#${num}`, inline: true },
          );

        await channel.send({ embeds: [embed] }).catch(console.error);
        break; // Only notify once per update cycle
      }
    }
  });

  console.log('✅ Fastest lap notifier active');
}
