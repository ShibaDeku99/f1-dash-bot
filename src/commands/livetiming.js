import { SlashCommandBuilder } from 'discord.js';
import {
  baseEmbed, COLORS, formatGap, sortDriversByPosition, getTrackStatus, noSessionEmbed, TIRE_EMOJI
} from '../formatters/utils.js';
import { getLeaderboardGapChartUrl, renderProgressBar } from '../formatters/charts.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('livetiming')
  .setDescription('⏱️ Full F1 Live Timing screen with sectors, speed trap and gaps')
  .addStringOption((opt) =>
    opt
      .setName('view')
      .setDescription('Choose timing view')
      .setRequired(false)
      .addChoices(
        { name: 'Top 10 Drivers', value: 'top10' },
        { name: 'All 20 Drivers', value: 'all' },
        { name: 'Sectors & Speed Traps', value: 'sectors' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const timingData = f1State.timingData;
  const driverList = f1State.driverList;
  const sessionInfo = f1State.sessionInfo;
  const sessionStatus = f1State.sessionStatus;
  const trackStatus = f1State.trackStatus;
  const lapCount = f1State.lapCount;
  const timingAppData = f1State.timingAppData;

  if (!timingData || !driverList) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const view = interaction.options.getString('view') || 'top10';
  const sorted = sortDriversByPosition(timingData.Lines);

  const sessionName = sessionInfo
    ? `${sessionInfo.Meeting?.Name} — ${sessionInfo.Name}`
    : 'Live Session';

  const isLive = sessionStatus?.Status === 'Started';
  const statusBadge = isLive
    ? '🔴 **LIVE TIMING**'
    : `🏁 **CLASSIFICATION (${sessionStatus?.Status || 'Finished'})**`;

  const trackFlag = trackStatus?.Status
    ? getTrackStatus(trackStatus.Status)
    : { label: 'Track Clear', emoji: '🟢' };

  let description = `${statusBadge} · ${trackFlag.emoji} **${trackFlag.label}**\n`;

  if (lapCount?.CurrentLap && lapCount?.TotalLaps) {
    const cur = parseInt(lapCount.CurrentLap) || 0;
    const tot = parseInt(lapCount.TotalLaps) || 1;
    const bar = renderProgressBar(cur, tot, 12);
    const pct = Math.round((cur / tot) * 100);
    description += `🏁 **Lap ${cur}/${tot}** \`${bar}\` **${pct}%**\n`;
  }

  const embed = baseEmbed(`⏱️ F1 Live Timing — ${sessionName}`, isLive ? COLORS.primary : COLORS.info)
    .setDescription(description);

  if (view === 'sectors') {
    // Sector-by-sector view
    const rows = sorted.slice(0, 10).map((td) => {
      const driver = driverList[td.RacingNumber];
      const tla = driver?.Tla || `#${td.RacingNumber}`;
      const pos = String(td.Position || '?').padStart(2);

      const s1 = td.Sectors?.[0];
      const s2 = td.Sectors?.[1];
      const s3 = td.Sectors?.[2];

      const s1Badge = s1?.OverallFastest ? '⚡' : s1?.PersonalFastest ? '🟣' : ' ';
      const s2Badge = s2?.OverallFastest ? '⚡' : s2?.PersonalFastest ? '🟣' : ' ';
      const s3Badge = s3?.OverallFastest ? '⚡' : s3?.PersonalFastest ? '🟣' : ' ';

      const s1Val = s1?.Value ? `${s1.Value}${s1Badge}` : '—';
      const s2Val = s2?.Value ? `${s2.Value}${s2Badge}` : '—';
      const s3Val = s3?.Value ? `${s3.Value}${s3Badge}` : '—';

      const speedTrap = td.Speeds?.ST?.Value ? `${td.Speeds.ST.Value} km/h` : '—';
      const best = td.BestLapTime?.Value || '—';

      return `\`${pos}\` **${tla}** ⏱ \`${best}\`\n  S1: \`${s1Val}\` S2: \`${s2Val}\` S3: \`${s3Val}\` · ST: \`${speedTrap}\``;
    });

    embed.addFields({
      name: '🏎️ Sectors & Speed Trap (⚡ Fastest · 🟣 Personal Best)',
      value: rows.join('\n\n'),
      inline: false,
    });
  } else {
    // Standard or All Timing view
    const limit = view === 'all' ? 20 : 10;
    const rows = sorted.slice(0, limit).map((td) => {
      const driver = driverList[td.RacingNumber];
      const tla = driver?.Tla || `#${td.RacingNumber}`;
      const pos = String(td.Position || '?').padStart(2);
      const team = driver?.TeamName?.substring(0, 10) || '';

      const stint = timingAppData?.Lines?.[td.RacingNumber]?.Stints?.at(-1);
      const compound = stint?.Compound || '';
      const tireEmoji = TIRE_EMOJI[compound] || '⚪';

      const best = td.BestLapTime?.Value || '—';
      const last = td.LastLapTime?.Value || '—';
      const gap = td.GapToLeader ? formatGap(td.GapToLeader) : 'Leader';
      const interval = td.IntervalToPositionAhead?.Value ? `+${td.IntervalToPositionAhead.Value}s` : '—';

      let status = '';
      if (td.InPit) status = ' 🔧 PIT';
      else if (td.PitOut) status = ' ↗️ OUT';
      else if (td.Retired) status = ' ❌ RET';
      else if (td.Stopped) status = ' 🛑 STOP';

      return `\`${pos}\` ${tireEmoji} **${tla}**${status} _${team}_\n  ⏱ Best: \`${best}\` | Last: \`${last}\`\n  📏 Gap: \`${gap}\` | Int: \`${interval}\``;
    });

    const chunkSize = 5;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).join('\n\n');
      embed.addFields({
        name: i === 0 ? `📊 Driver Standings (P${i + 1}–P${i + chunkSize})` : `P${i + 1}–P${Math.min(i + chunkSize, rows.length)}`,
        value: chunk,
        inline: false,
      });
    }
  }

  // Attach live Gap Chart
  const chartUrl = getLeaderboardGapChartUrl(timingData.Lines, driverList);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}
