import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';
import { getNextRace, formatVietnamTime } from '../scheduleService.js';

export const data = new SlashCommandBuilder()
  .setName('next-race')
  .setDescription('🗓️ Show next F1 race weekend & schedule (Giờ Việt Nam GMT+7)');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const round = await getNextRace();

    if (!round) {
      return interaction.editReply({
        embeds: [
          baseEmbed('🏁 Season Complete', COLORS.neutral)
            .setDescription('The Formula 1 season has ended. See you next year! 🏆'),
        ],
      });
    }

    const embed = buildRoundEmbed(round, '📅 Next Race');
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to fetch next race:', err);
    await interaction.editReply({
      embeds: [
        baseEmbed('❌ Error', COLORS.danger)
          .setDescription('Could not fetch calendar data. Please try again later.'),
      ],
    });
  }
}

export function buildRoundEmbed(round, title = '📅 Race') {
  const embed = baseEmbed(`${title} — ${round.name}`, COLORS.primary)
    .addFields(
      { name: '🌍 Quốc gia', value: round.countryName, inline: true },
      {
        name: '📅 Bắt đầu (Giờ VN)',
        value: formatVietnamTime(round.start),
        inline: true,
      },
      {
        name: '🏁 Kết thúc (Giờ VN)',
        value: formatVietnamTime(round.end),
        inline: true,
      },
    );

  const now = Date.now();
  let nextUpcomingSession = null;

  if (round.sessions?.length) {
    const sessionLines = round.sessions.map((s) => {
      const sStart = new Date(s.start).getTime();
      const sEnd = new Date(s.end).getTime();
      const isPast = sEnd < now;
      const isLive = now >= sStart && now <= sEnd;
      const timeVN = formatVietnamTime(s.start);

      if (!nextUpcomingSession && sEnd > now) {
        nextUpcomingSession = s;
      }

      if (isPast) {
        return `~~${s.kind}~~ — ${timeVN} ✅`;
      } else if (isLive) {
        return `🔴 **${s.kind}** — **${timeVN}** (ĐANG DIỄN RA)`;
      } else {
        return `**${s.kind}** — ${timeVN}`;
      }
    });

    embed.addFields({
      name: '🕐 Các phiên chạy (Giờ Việt Nam - GMT+7)',
      value: sessionLines.join('\n'),
      inline: false,
    });
  }

  // Countdown to next upcoming session (e.g. Race or Qualifying)
  if (nextUpcomingSession) {
    const sStart = new Date(nextUpcomingSession.start).getTime();
    const msLeft = sStart - now;
    const unix = Math.floor(sStart / 1000);

    if (msLeft > 0) {
      embed.addFields({
        name: `⏳ Đếm ngược đến ${nextUpcomingSession.kind}`,
        value: `👉 **<t:${unix}:R>** (${formatCountdown(msLeft)})\n⏰ Khởi tranh: **${formatVietnamTime(nextUpcomingSession.start)}**`,
        inline: false,
      });
    }
  }

  return embed;
}

function formatCountdown(ms) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (mins > 0) parts.push(`${mins} phút`);
  return parts.join(' ') || 'Sắp bắt đầu!';
}
