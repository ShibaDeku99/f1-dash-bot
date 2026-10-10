import { config } from '../config.js';
import { f1State } from '../state.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';

/**
 * Team Radio notifier
 * Posts a notification when a new team radio clip is available
 */
export function setupTeamRadioNotifier(client) {
  const channelId = config.channels.teamRadio;
  if (!channelId) {
    console.warn('⚠️  TEAM_RADIO_CHANNEL_ID not set, skipping team radio notifications');
    return;
  }

  let seenPaths = new Set();

  f1State.on('update', async (state) => {
    const captures = state?.TeamRadio?.Captures;
    if (!captures?.length) return;

    // Mark all initial as seen
    if (seenPaths.size === 0) {
      captures.forEach((c) => seenPaths.add(c.Path));
      return;
    }

    const newCaptures = captures.filter((c) => !seenPaths.has(c.Path));
    if (!newCaptures.length) return;

    newCaptures.forEach((c) => seenPaths.add(c.Path));

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const driverList = f1State.driverList;
    const sessionInfo = f1State.sessionInfo;

    for (const capture of newCaptures) {
      const driver = driverList?.[capture.RacingNumber];
      const driverName = driver
        ? `${driver.FullName} (${driver.Tla})`
        : `Driver #${capture.RacingNumber}`;
      const team = driver?.TeamName ?? '';

      // Build audio URL (F1 live timing CDN)
      const audioUrl = `https://livetiming.formula1.com/static/${capture.Path}`;

      const embed = baseEmbed(`🎙️ Team Radio — ${driverName}`, COLORS.info)
        .setDescription(
          `**${team}**\n🔊 [Listen to radio clip](${audioUrl})`
        )
        .addFields({
          name: '⏰ Time',
          value: new Date(capture.Utc).toLocaleTimeString('en-GB'),
          inline: true,
        });

      await channel.send({ embeds: [embed] }).catch(console.error);
    }
  });

  console.log('✅ Team radio notifier active');
}
