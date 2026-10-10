import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';
import { getSchedule, formatVietnamTime } from '../scheduleService.js';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('🗓️ Xem toàn bộ lịch thi đấu F1 mùa giải (Giờ Việt Nam GMT+7)');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const schedule = await getSchedule();

    if (!schedule.length) {
      return interaction.editReply({
        embeds: [
          baseEmbed('🗓️ Không tìm thấy lịch thi đấu', COLORS.neutral)
            .setDescription('Không tìm thấy chặng đua nào trong mùa giải này.'),
        ],
      });
    }

    const upcoming = schedule.filter((r) => !r.over);
    const past = schedule.filter((r) => r.over);

    const embed = baseEmbed(`🗓️ Lịch thi đấu F1 Mùa giải ${new Date().getFullYear()} (Giờ VN)`, COLORS.primary)
      .setDescription(`**${past.length}** chặng đã diễn ra · **${upcoming.length}** chặng còn lại`);

    // Show next 8 upcoming rounds
    const upcomingLines = upcoming.slice(0, 8).map((round, i) => {
      const date = formatVietnamTime(round.start);
      const marker = i === 0 ? '👉 **CHẶNG TIẾP THEO**' : '';
      return `${marker}\n📍 **${round.name}** — ${round.countryName}\n    📅 ${date}`;
    });

    if (upcomingLines.length) {
      embed.addFields({
        name: '🔜 Các chặng sắp diễn ra (Giờ VN - GMT+7)',
        value: upcomingLines.join('\n\n'),
        inline: false,
      });
    }

    // Show last 3 completed
    const pastLines = past.slice(-3).reverse().map((round) => {
      const date = formatVietnamTime(round.start);
      return `~~${round.name}~~ — ${round.countryName} (${date})`;
    });

    if (pastLines.length) {
      embed.addFields({
        name: '✅ Các chặng gần nhất đã hoàn thành',
        value: pastLines.join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to fetch schedule:', err);
    await interaction.editReply({
      embeds: [
        baseEmbed('❌ Lỗi', COLORS.danger)
          .setDescription('Không thể tải dữ liệu lịch thi đấu. Vui lòng thử lại sau.'),
      ],
    });
  }
}
