import { SlashCommandBuilder } from 'discord.js';
import {
  baseEmbed, COLORS, formatGap, sortDriversByPosition, noSessionEmbed
} from '../formatters/utils.js';
import { getLeaderboardGapChartUrl, renderProgressBar } from '../formatters/charts.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('📊 Show the current live leaderboard with gap chart');

export async function execute(interaction) {
  await interaction.deferReply();

  const timingData = f1State.timingData;
  const driverList = f1State.driverList;
  const sessionInfo = f1State.sessionInfo;
  const lapCount = f1State.lapCount;

  if (!timingData || !driverList) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const sorted = sortDriversByPosition(timingData.Lines);

  const sessionName = sessionInfo
    ? `${sessionInfo.Meeting?.Name} — ${sessionInfo.Name}`
    : 'Live Session';

  let description = '';
  if (lapCount?.CurrentLap && lapCount?.TotalLaps) {
    const cur = parseInt(lapCount.CurrentLap) || 0;
    const tot = parseInt(lapCount.TotalLaps) || 1;
    const pct = Math.round((cur / tot) * 100);
    const bar = renderProgressBar(cur, tot, 14);
    description = `🏁 **Lap ${cur}/${tot}** \`${bar}\` **${pct}%**`;
  }

  const embed = baseEmbed(`🏎️ Leaderboard — ${sessionName}`, COLORS.primary);
  if (description) embed.setDescription(description);

  // Build table rows (max 20 drivers)
  const rows = sorted.slice(0, 20).map((td) => {
    const driver = driverList[td.RacingNumber];
    const name = driver ? `${driver.Tla}` : `#${td.RacingNumber}`;
    const teamName = driver?.TeamName?.substring(0, 10) ?? '';
    const gap = td.GapToLeader ? formatGap(td.GapToLeader) : td.IntervalToPositionAhead?.Value ? `+${td.IntervalToPositionAhead.Value}` : '—';
    const lastLap = td.LastLapTime?.Value || '—';
    const pos = parseInt(td.Position) || '?';

    let status = '';
    if (td.InPit) status = ' 🔧';
    else if (td.PitOut) status = ' ↗️';
    else if (td.Retired) status = ' ❌';

    return `\`${String(pos).padStart(2)}\` **${name}**${status} ${teamName}\n    ⏱ ${lastLap}  📏 ${gap}`;
  });

  // Discord embed field limit: split into chunks of 5
  const chunkSize = 5;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).join('\n');
    embed.addFields({
      name: i === 0 ? 'Pos  Driver  Gap  Last Lap' : '\u200b',
      value: chunk,
      inline: false,
    });
  }

  // Attach Gap to Leader Chart
  const chartUrl = getLeaderboardGapChartUrl(timingData.Lines, driverList);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}
