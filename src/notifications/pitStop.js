import { config } from '../config.js';
import { f1State } from '../state.js';
import { baseEmbed, COLORS, formatTire, teamColor } from '../formatters/utils.js';

/**
 * Pit Stop notifier
 * Detects when drivers enter the pit lane
 */
export function setupPitStopNotifier(client) {
  const channelId = config.channels.raceControl;
  if (!channelId) return;

  // Track pit state per driver: { inPit: bool, pitOut: bool }
  const driverPitState = new Map();

  f1State.on('update', async (state) => {
    const timingData = state?.TimingData;
    const driverList = state?.DriverList;
    const timingAppData = state?.TimingAppData;

    if (!timingData?.Lines || !driverList) return;
    if (!f1State.isSessionLive()) return; // Only notify during live session

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    for (const [num, td] of Object.entries(timingData.Lines)) {
      const prev = driverPitState.get(num) ?? { inPit: false, pitOut: false };

      // Driver just entered pit
      if (td.InPit && !prev.inPit) {
        driverPitState.set(num, { inPit: true, pitOut: false });

        const driver = driverList[num];
        const driverName = driver ? `${driver.FullName} (${driver.Tla})` : `#${num}`;
        const team = driver?.TeamName ?? '';
        const color = teamColor(driver?.TeamColour);
        const stint = timingAppData?.Lines?.[num]?.Stints?.at(-1);

        const embed = baseEmbed(`🔧 Pit Stop — ${driverName}`, color)
          .addFields(
            { name: '🏎️ Team', value: team, inline: true },
            { name: '📍 Position', value: `P${td.Position}`, inline: true },
          );

        if (stint) {
          embed.addFields({ name: '🔋 On Tires', value: formatTire(stint), inline: true });
        }

        await channel.send({ embeds: [embed] }).catch(console.error);
      }

      // Driver just left pit
      if (td.PitOut && !prev.pitOut && !td.InPit) {
        driverPitState.set(num, { inPit: false, pitOut: true });

        const driver = driverList[num];
        const driverName = driver ? `${driver.FullName} (${driver.Tla})` : `#${num}`;
        const color = teamColor(driver?.TeamColour);
        const appData = timingAppData?.Lines?.[num];
        const newStint = appData?.Stints?.at(-1);

        const embed = baseEmbed(`↗️ Pit Out — ${driverName}`, color)
          .addFields({ name: '📍 Position', value: `P${td.Position}`, inline: true });

        if (newStint) {
          embed.addFields({ name: '🔋 New Tires', value: formatTire(newStint), inline: true });
        }

        await channel.send({ embeds: [embed] }).catch(console.error);
      }

      // Reset state when neither inPit nor pitOut
      if (!td.InPit && !td.PitOut) {
        driverPitState.set(num, { inPit: false, pitOut: false });
      }
    }
  });

  console.log('✅ Pit stop notifier active');
}
