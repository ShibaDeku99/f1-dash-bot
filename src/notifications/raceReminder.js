import cron from 'node-cron';
import { config } from '../config.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';
import { getNextRace } from '../scheduleService.js';

/**
 * Pre-race reminder notifier
 * Checks schedule every 5 minutes and sends reminders 1h and 30min before each session
 */
export function setupRaceReminder(client) {
  const channelId = config.channels.sessionAlert;
  if (!channelId) return;

  const notified = new Set(); // Track which sessions we've notified

  // Check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const round = await getNextRace();
      if (!round) return;

      const now = Date.now();

      for (const session of round.sessions ?? []) {
        const sessionStart = new Date(session.start).getTime();
        const msUntil = sessionStart - now;

        // 1 hour reminder (between 55–65 min before)
        const key1h = `1h:${session.start}`;
        if (msUntil > 55 * 60 * 1000 && msUntil < 65 * 60 * 1000 && !notified.has(key1h)) {
          notified.add(key1h);
          await sendReminder(client, channelId, round, session, '1 hour');
        }

        // 30 min reminder (between 25–35 min before)
        const key30m = `30m:${session.start}`;
        if (msUntil > 25 * 60 * 1000 && msUntil < 35 * 60 * 1000 && !notified.has(key30m)) {
          notified.add(key30m);
          await sendReminder(client, channelId, round, session, '30 minutes');
        }
      }
    } catch (err) {
      // Silently ignore — network or parse temporary error
    }
  });

  console.log('✅ Race reminder scheduler active (checks every 5 min)');
}

async function sendReminder(client, channelId, round, session, timeLeft) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const sessionStart = new Date(session.start);
  const timeStr = sessionStart.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const embed = baseEmbed(
    `⏰ ${session.kind} in ${timeLeft}!`,
    COLORS.warning
  )
    .setDescription(`**${round.name}** is starting soon!`)
    .addFields(
      { name: '🏁 Session', value: session.kind, inline: true },
      { name: '📍 Location', value: round.countryName, inline: true },
      { name: '🕐 Start Time', value: `${timeStr} UTC`, inline: true },
    );

  await channel.send({ content: '@here', embeds: [embed] }).catch(console.error);
}
