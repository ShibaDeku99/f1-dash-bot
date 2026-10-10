import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, formatTire, noSessionEmbed } from '../formatters/utils.js';
import { getTireDonutChartUrl, renderProgressBar } from '../formatters/charts.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('tire')
  .setDescription('🔋 Show tire status with grid compound chart');

export async function execute(interaction) {
  await interaction.deferReply();

  const driverList = f1State.driverList;
  const timingAppData = f1State.timingAppData;
  const timingData = f1State.timingData;
  const sessionInfo = f1State.sessionInfo;

  if (!driverList || !timingAppData || !timingData) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const sessionName = sessionInfo
    ? `${sessionInfo.Meeting?.Name} — ${sessionInfo.Name}`
    : 'Live Session';

  // Sort drivers by position
  const sortedDriverNums = Object.values(timingData.Lines)
    .sort((a, b) => (parseInt(a.Position) || 99) - (parseInt(b.Position) || 99))
    .map((d) => d.RacingNumber);

  const lines = sortedDriverNums.map((num) => {
    const driver = driverList[num];
    const appData = timingAppData.Lines?.[num];
    const stint = appData?.Stints?.at(-1);
    const td = timingData.Lines?.[num];
    const pos = td?.Position ? `P${td.Position}` : '?';
    const tla = driver?.Tla ?? `#${num}`;

    const laps = stint?.TotalLaps != null ? parseInt(stint.TotalLaps) : 0;
    const bar = renderProgressBar(laps, 40, 6);

    return `\`${pos.padStart(3)}\` **${tla}** \`${bar}\` ${formatTire(stint)}`;
  });

  const embed = baseEmbed(`🔋 Tire Status & Compounds — ${sessionName}`, COLORS.primary);

  // Split into 2 columns of 10
  const half = Math.ceil(lines.length / 2);
  embed.addFields(
    { name: 'P1–P10', value: lines.slice(0, half).join('\n') || '—', inline: true },
    { name: 'P11–P20', value: lines.slice(half).join('\n') || '—', inline: true },
  );

  // Attach Tire Donut Chart
  const chartUrl = getTireDonutChartUrl(timingAppData);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}
