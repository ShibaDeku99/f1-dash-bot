import { SlashCommandBuilder } from 'discord.js';
import {
  baseEmbed, COLORS, formatTire, noSessionEmbed, teamColor
} from '../formatters/utils.js';
import { getDriverSectorChartUrl, renderProgressBar } from '../formatters/charts.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('driver')
  .setDescription('🏎️ Get detailed info and telemetry chart for a specific driver')
  .addStringOption((opt) =>
    opt.setName('name')
      .setDescription('Driver TLA (e.g. VER, HAM, LEC) or racing number (e.g. 1, 44)')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const query = interaction.options.getString('name').toUpperCase();
  const driverList = f1State.driverList;
  const timingData = f1State.timingData;
  const timingAppData = f1State.timingAppData;

  if (!driverList || !timingData) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  // Find driver by TLA or racing number
  const driver = Object.values(driverList).find(
    (d) => d.Tla === query || d.RacingNumber === query
  );

  if (!driver) {
    return interaction.editReply({
      embeds: [
        baseEmbed('❌ Driver Not Found', COLORS.danger)
          .setDescription(`Could not find driver **${query}**.\nUse TLA (VER, HAM, LEC) or racing number (1, 44, 16).`),
      ],
    });
  }

  const td = timingData.Lines?.[driver.RacingNumber];
  const appData = timingAppData?.Lines?.[driver.RacingNumber];
  const currentStint = appData?.Stints?.at(-1);

  const color = teamColor(driver.TeamColour);
  const pos = td?.Position ? `P${td.Position}` : '?';

  let statusLine = '';
  if (td?.Retired) statusLine = '❌ Retired';
  else if (td?.InPit) statusLine = '🔧 In Pit Lane';
  else if (td?.PitOut) statusLine = '↗️ Pit Out';
  else if (td?.Stopped) statusLine = '🛑 Stopped';

  const embed = baseEmbed(`🏎️ ${driver.FullName} (${driver.Tla})`, color)
    .addFields(
      { name: '🏆 Position', value: `**${pos}**`, inline: true },
      { name: '🏎️ Team', value: driver.TeamName || '—', inline: true },
      { name: '🔢 Number', value: `#${driver.RacingNumber}`, inline: true },
    );

  if (statusLine) {
    embed.addFields({ name: '📌 Status', value: statusLine, inline: false });
  }

  // Timing fields
  if (td) {
    embed.addFields(
      {
        name: '⏱️ Last Lap',
        value: td.LastLapTime?.Value || '—',
        inline: true,
      },
      {
        name: '🏅 Best Lap',
        value: td.BestLapTime?.Value || '—',
        inline: true,
      },
      {
        name: '📏 Gap to Leader',
        value: td.GapToLeader ? `+${td.GapToLeader}` : '—',
        inline: true,
      },
      {
        name: '📏 Interval',
        value: td.IntervalToPositionAhead?.Value
          ? `+${td.IntervalToPositionAhead.Value}`
          : '—',
        inline: true,
      },
      {
        name: '🔄 Laps',
        value: String(td.NumberOfLaps ?? '—'),
        inline: true,
      },
      {
        name: '🔧 Pit Stops',
        value: String(td.NumberOfPitStops ?? '0'),
        inline: true,
      },
    );

    // Sectors
    if (td.Sectors?.length) {
      const sectors = td.Sectors.map((s, i) => {
        const fastest = s.OverallFastest ? '⚡ (Fastest)' : s.PersonalFastest ? '🟣 (PB)' : '';
        return `**S${i + 1}**: \`${s.Value || '—'}\` ${fastest}`;
      }).join('\n');
      embed.addFields({ name: '📐 Sectors', value: sectors, inline: false });
    }
  }

  // Tire info with visual wear bar
  if (currentStint) {
    const laps = parseInt(currentStint.TotalLaps) || 0;
    const tireBar = renderProgressBar(laps, 40, 10);
    embed.addFields({
      name: '🔋 Current Tire Stint',
      value: `${formatTire(currentStint)}\n\`${tireBar}\` ${laps} laps on tire`,
      inline: false,
    });
  }

  // Stint history
  if (appData?.Stints?.length > 1) {
    const history = appData.Stints.map((s, i) =>
      `**Stint ${i + 1}**: ${formatTire(s)}`
    ).join('\n');
    embed.addFields({ name: '📋 Stint History', value: history, inline: false });
  }

  // Attach Sector Comparison Chart
  const chartUrl = getDriverSectorChartUrl(driver, timingData, driverList);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}
