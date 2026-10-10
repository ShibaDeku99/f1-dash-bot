import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, positionMedal, teamColor, noSessionEmbed } from '../formatters/utils.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('top3')
  .setDescription('🏆 Show the current top 3 drivers');

export async function execute(interaction) {
  await interaction.deferReply();

  const topThree = f1State.topThree;
  const sessionInfo = f1State.sessionInfo;

  if (!topThree?.Lines?.length) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const sessionName = sessionInfo
    ? `${sessionInfo.Meeting?.Name} — ${sessionInfo.Name}`
    : 'Live Session';

  const embed = baseEmbed(`🏆 Top 3 — ${sessionName}`, COLORS.primary);

  topThree.Lines.slice(0, 3).forEach((driver) => {
    const pos = parseInt(driver.Position);
    const medal = positionMedal(pos);
    const color = driver.TeamColour ? `#${driver.TeamColour}` : '';
    const fastest = driver.OverallFastest ? ' ⚡ **Fastest**' : '';
    embed.addFields({
      name: `${medal} ${driver.FullName} (${driver.Tla})`,
      value: [
        `🏎️ ${driver.Team}`,
        `⏱️ Lap: \`${driver.LapTime || '—'}\``,
        `📏 Gap to Ahead: \`${driver.DiffToAhead || '—'}\``,
        `📏 Gap to Leader: \`${driver.DiffToLeader || '—'}\`${fastest}`,
      ].join('\n'),
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}
