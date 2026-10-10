import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';
import { getNextSession, formatVietnamTime } from '../scheduleService.js';

export const data = new SlashCommandBuilder()
  .setName('countdown')
  .setDescription('⏳ Đếm ngược đến phiên chạy F1 tiếp theo (Giờ Việt Nam GMT+7)');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const next = await getNextSession();

    if (!next) {
      return interaction.editReply({
        embeds: [
          baseEmbed('🏁 Mùa giải đã kết thúc', COLORS.neutral)
            .setDescription('Mùa giải Formula 1 đã hoàn thành toàn bộ các chặng đua. Hẹn gặp lại mùa giải sau! 🏆'),
        ],
      });
    }

    const { round, session, isLive, unixTimestamp, msUntilStart } = next;

    if (isLive) {
      const endUnix = Math.floor(next.endTime.getTime() / 1000);
      const embed = baseEmbed(`🔴 ĐANG DIỄN RA: ${session.kind} — ${round.name}`, COLORS.danger)
        .setDescription(`🏁 Phiên chạy **${session.kind}** đang diễn ra trực tiếp!\n⏳ Dự kiến kết thúc: <t:${endUnix}:R>`)
        .addFields(
          { name: '📍 Chặng đua', value: `${round.name} (${round.countryName})`, inline: true },
          { name: '⏰ Bắt đầu (Giờ VN)', value: formatVietnamTime(session.start), inline: true },
          { name: '🏁 Kết thúc (Giờ VN)', value: formatVietnamTime(session.end), inline: true },
        );
      return interaction.editReply({ embeds: [embed] });
    }

    const countdownStr = formatCountdown(msUntilStart);
    const embed = baseEmbed(`⏳ Đếm ngược: ${session.kind} — ${round.name}`, COLORS.primary)
      .setDescription(`Phiên chạy F1 tiếp theo chuẩn bị khởi tranh!`)
      .addFields(
        {
          name: '🏁 Phiên chạy',
          value: `**${session.kind}**`,
          inline: true,
        },
        {
          name: '📍 Địa điểm',
          value: `${round.name}\n${round.countryName}`,
          inline: true,
        },
        {
          name: '⏳ Đếm ngược',
          value: `👉 **<t:${unixTimestamp}:R>**\n_(${countdownStr})_`,
          inline: false,
        },
        {
          name: '⏰ Thời gian khởi tranh (Giờ Việt Nam - GMT+7)',
          value: `📅 **${formatVietnamTime(session.start)}**\n🌐 Giờ thiết bị: <t:${unixTimestamp}:F>`,
          inline: false,
        },
      );

    // Show full weekend schedule with VN Time
    if (round.sessions?.length) {
      const now = Date.now();
      const scheduleLines = round.sessions.map((s) => {
        const sStart = new Date(s.start).getTime();
        const sEnd = new Date(s.end).getTime();
        const isPast = sEnd < now;
        const isCurrent = s.kind === session.kind;
        const timeVN = formatVietnamTime(s.start);

        if (isPast) {
          return `~~${s.kind}~~ — ${timeVN} ✅`;
        } else if (isCurrent) {
          return `👉 **${s.kind}** — **${timeVN}** (<t:${Math.floor(sStart / 1000)}:R>) ⏳`;
        } else {
          return `**${s.kind}** — ${timeVN}`;
        }
      });

      embed.addFields({
        name: '🗓️ Lịch toàn bộ chặng đua (Giờ Việt Nam - GMT+7)',
        value: scheduleLines.join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to calculate countdown:', err);
    await interaction.editReply({
      embeds: [
        baseEmbed('❌ Lỗi', COLORS.danger)
          .setDescription('Không thể tính toán đếm ngược lịch thi đấu. Vui lòng thử lại sau.'),
      ],
    });
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Đang chuẩn bị xuất phát!';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (mins > 0) parts.push(`${mins} phút`);
  if (parts.length === 0 || days === 0) parts.push(`${secs} giây`);

  return parts.join(' ');
}
