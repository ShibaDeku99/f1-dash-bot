import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, positionMedal } from '../formatters/utils.js';
import { getDriverStandingsChartUrl, getTeamStandingsChartUrl } from '../formatters/charts.js';
import { getStandings } from '../standingsService.js';

export const data = new SlashCommandBuilder()
  .setName('championship')
  .setDescription('🏆 Bảng xếp hạng tay đua & đội đua F1 thế giới (Standings & Points)')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Chọn bảng xếp hạng')
      .setRequired(false)
      .addChoices(
        { name: '🏎️ BXH Tay đua (Driver Standings)', value: 'drivers' },
        { name: '🏭 BXH Đội đua (Constructors Standings)', value: 'constructors' },
        { name: '📊 Toàn bộ (Cả Tay đua & Đội đua)', value: 'all' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const standings = await getStandings();
    const type = interaction.options.getString('type') || 'drivers';

    const { drivers, teams, isLive, sessionName } = standings;
    const liveBadge = isLive ? '🔴 LIVE PREDICTION' : '🏁 BẢNG XẾP HẠNG CHÍNH THỨC';

    const embed = baseEmbed(
      `🏆 Bảng Xếp Hạng F1 ${new Date().getFullYear()} — ${sessionName}`,
      isLive ? COLORS.primary : COLORS.warning
    ).setDescription(`${liveBadge}\n_Dữ liệu cập nhật từ F1 Official Live Timing_`);

    if (type === 'constructors') {
      // Constructors only
      const teamRows = teams.map((t) => {
        const medal = positionMedal(t.position);
        return `\`${medal.padEnd(3)}\` **${t.teamName}** — **${t.points}** pts`;
      });

      embed.addFields({
        name: '🏭 Bảng Xếp Hạng Đội Đua (Constructors Championship)',
        value: teamRows.join('\n') || '—',
        inline: false,
      });

      const chartUrl = getTeamStandingsChartUrl(teams);
      if (chartUrl) embed.setImage(chartUrl);
    } else if (type === 'all') {
      // Both
      const driverRows = drivers.slice(0, 10).map((d) => {
        const medal = positionMedal(d.position);
        const posDiffStr = d.posDiff > 0 ? `▲${d.posDiff}` : d.posDiff < 0 ? `▼${Math.abs(d.posDiff)}` : '━';
        return `\`${medal.padEnd(3)}\` **${d.tla}** (${d.fullName}) — **${d.points}** pts ${isLive ? posDiffStr : ''}`;
      });

      const teamRows = teams.slice(0, 5).map((t) => {
        const medal = positionMedal(t.position);
        return `\`${medal.padEnd(3)}\` **${t.teamName}** — **${t.points}** pts`;
      });

      embed.addFields(
        {
          name: '🏎️ BXH Tay Đua (Top 10 Drivers)',
          value: driverRows.join('\n') || '—',
          inline: false,
        },
        {
          name: '🏭 BXH Đội Đua (Top 5 Constructors)',
          value: teamRows.join('\n') || '—',
          inline: false,
        }
      );

      const chartUrl = getDriverStandingsChartUrl(drivers);
      if (chartUrl) embed.setImage(chartUrl);
    } else {
      // Default: Drivers
      const driverRows = drivers.slice(0, 20).map((d) => {
        const medal = positionMedal(d.position);
        const posDiffStr = isLive && d.posDiff !== 0
          ? (d.posDiff > 0 ? `▲${d.posDiff}` : `▼${Math.abs(d.posDiff)}`)
          : '';
        return `\`${medal.padEnd(3)}\` **${d.tla}** · ${d.fullName} _(${d.teamName})_\n      📊 **${d.points} pts** ${posDiffStr}`;
      });

      // Split into 2 chunks of 10
      const half = Math.ceil(driverRows.length / 2);
      embed.addFields(
        {
          name: '🏎️ BXH Tay Đua: P1 — P10',
          value: driverRows.slice(0, half).join('\n') || '—',
          inline: false,
        },
        {
          name: '🏎️ BXH Tay Đua: P11 — P20',
          value: driverRows.slice(half).join('\n') || '—',
          inline: false,
        }
      );

      const chartUrl = getDriverStandingsChartUrl(drivers);
      if (chartUrl) embed.setImage(chartUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to get championship standings:', err);
    await interaction.editReply({
      embeds: [
        baseEmbed('❌ Lỗi', COLORS.danger)
          .setDescription('Không thể tải bảng xếp hạng F1 lúc này. Vui lòng thử lại sau.'),
      ],
    });
  }
}
