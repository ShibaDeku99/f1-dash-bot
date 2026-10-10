import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { f1State } from '../state.js';
import { FLAG_EMOJI, COLORS, baseEmbed, getTrackStatus } from '../formatters/utils.js';

/**
 * Race Control Messages notifier
 * Watches for new messages and posts them to the race control channel
 */
export function setupRaceControlNotifier(client) {
  const channelId = config.channels.raceControl;
  if (!channelId) {
    console.warn('⚠️  RACE_CONTROL_CHANNEL_ID not set, skipping race control notifications');
    return;
  }

  let seenTimestamps = new Set();

  f1State.on('update', async (state) => {
    const messages = state?.RaceControlMessages?.Messages;
    if (!messages?.length) return;

    // On first data, mark all existing as seen (don't spam old messages)
    if (seenTimestamps.size === 0) {
      messages.forEach((m) => seenTimestamps.add(m.Utc));
      return;
    }

    const newMessages = messages.filter((m) => !seenTimestamps.has(m.Utc));
    if (!newMessages.length) return;

    newMessages.forEach((m) => seenTimestamps.add(m.Utc));

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    for (const msg of newMessages) {
      const embed = buildRaceControlEmbed(msg);
      await channel.send({ embeds: [embed] }).catch(console.error);
    }
  });

  console.log('✅ Race control notifier active');
}

function buildRaceControlEmbed(msg) {
  const flagEmoji = msg.Flag ? (FLAG_EMOJI[msg.Flag] ?? '🏴') : null;
  const color = getFlagColor(msg.Flag, msg.Category);

  const title = buildTitle(msg, flagEmoji);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(msg.Message)
    .setFooter({ text: 'F1 Race Control' })
    .setTimestamp(new Date(msg.Utc));

  if (msg.Lap) {
    embed.addFields({ name: '🔄 Lap', value: String(msg.Lap), inline: true });
  }

  if (msg.Scope) {
    embed.addFields({ name: '📍 Scope', value: msg.Scope, inline: true });
  }

  if (msg.Sector != null) {
    embed.addFields({ name: '📐 Sector', value: String(msg.Sector), inline: true });
  }

  return embed;
}

function buildTitle(msg, flagEmoji) {
  if (msg.Category === 'SafetyCar') {
    if (msg.Message.includes('VIRTUAL')) return '🟠 Virtual Safety Car';
    if (msg.Message.includes('DEPLOYED')) return '🚗 Safety Car Deployed';
    if (msg.Message.includes('IN THIS LAP')) return '🚗 Safety Car In This Lap';
    return '🚗 Safety Car';
  }

  if (msg.Category === 'Flag') {
    const flag = flagEmoji ?? '🏴';
    const flagName = msg.Flag
      ? msg.Flag.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
      : 'Flag';
    return `${flag} ${flagName} Flag`;
  }

  if (msg.Category === 'Drs') return '📡 DRS Update';
  if (msg.Category === 'Sector') return '📐 Sector Update';

  return '📢 Race Control';
}

function getFlagColor(flag, category) {
  if (category === 'SafetyCar') return 0xf97316; // orange
  switch (flag) {
    case 'RED': return COLORS.danger;
    case 'YELLOW':
    case 'DOUBLE YELLOW': return 0xeab308;
    case 'GREEN':
    case 'CLEAR': return COLORS.success;
    case 'CHEQUERED': return 0xffffff;
    default: return COLORS.info;
  }
}
