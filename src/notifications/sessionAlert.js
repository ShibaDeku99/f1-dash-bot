import { config } from '../config.js';
import { f1State } from '../state.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';

/**
 * Session status notifier
 * Alerts when session starts, ends, or changes
 */
export function setupSessionNotifier(client) {
  const channelId = config.channels.sessionAlert;
  if (!channelId) {
    console.warn('⚠️  SESSION_ALERT_CHANNEL_ID not set, skipping session notifications');
    return;
  }

  let lastStatus = null;
  let lastSessionKey = null;

  f1State.on('update', async (state) => {
    const sessionInfo = state?.SessionInfo;
    const sessionStatus = state?.SessionStatus?.Status;

    if (!sessionStatus || !sessionInfo) return;

    const sessionKey = sessionInfo.Key;

    // New session detected
    if (sessionKey !== lastSessionKey) {
      lastSessionKey = sessionKey;
      lastStatus = null; // Reset so we catch the start event
    }

    if (sessionStatus === lastStatus) return;

    const prevStatus = lastStatus;
    lastStatus = sessionStatus;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = buildSessionEmbed(sessionInfo, sessionStatus, prevStatus);
    if (embed) {
      await channel.send({ embeds: [embed] }).catch(console.error);
    }
  });

  console.log('✅ Session notifier active');
}

function buildSessionEmbed(sessionInfo, status, prevStatus) {
  const meetingName = sessionInfo.Meeting?.Name ?? 'Unknown Meeting';
  const sessionName = sessionInfo.Name ?? 'Session';
  const circuit = sessionInfo.Meeting?.Circuit?.ShortName ?? '';

  switch (status) {
    case 'Started':
      return baseEmbed(`🟢 Session Started — ${meetingName}`, COLORS.success)
        .setDescription(`**${sessionName}** is now live!\n🏟️ ${circuit}`)
        .addFields(
          { name: '📍 Location', value: sessionInfo.Meeting?.Location ?? '—', inline: true },
          { name: '🌐 Country', value: sessionInfo.Meeting?.Country?.Name ?? '—', inline: true },
        );

    case 'Finished':
      return baseEmbed(`🏁 Session Finished — ${meetingName}`, COLORS.warning)
        .setDescription(`**${sessionName}** has finished.`);

    case 'Finalised':
      return baseEmbed(`✅ Session Finalised — ${meetingName}`, COLORS.neutral)
        .setDescription(`**${sessionName}** results are finalised.`);

    case 'Ends':
      return baseEmbed(`🔴 Session Ended — ${meetingName}`, COLORS.neutral)
        .setDescription(`**${sessionName}** has ended.`);

    default:
      return null;
  }
}
