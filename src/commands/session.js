import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, noSessionEmbed } from '../formatters/utils.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('session')
  .setDescription('📋 Show current session information');

export async function execute(interaction) {
  await interaction.deferReply();

  const sessionInfo = f1State.sessionInfo;
  const sessionStatus = f1State.sessionStatus;
  const lapCount = f1State.lapCount;
  const clock = f1State.extrapolatedClock;

  if (!sessionInfo) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const status = sessionStatus?.Status ?? 'Unknown';
  const statusEmoji = {
    Started: '🟢',
    Finished: '🏁',
    Finalised: '✅',
    Ends: '🔴',
  }[status] ?? '⬜';

  const embed = baseEmbed(`📋 ${sessionInfo.Meeting?.Name}`, COLORS.info)
    .addFields(
      { name: '🏁 Session', value: sessionInfo.Name ?? '—', inline: true },
      { name: '📌 Status', value: `${statusEmoji} ${status}`, inline: true },
      { name: '🌍 Location', value: sessionInfo.Meeting?.Location ?? '—', inline: true },
      { name: '🏟️ Circuit', value: sessionInfo.Meeting?.Circuit?.ShortName ?? '—', inline: true },
      { name: '🌐 Country', value: sessionInfo.Meeting?.Country?.Name ?? '—', inline: true },
    );

  if (lapCount) {
    embed.addFields({
      name: '🔄 Lap',
      value: `${lapCount.CurrentLap} / ${lapCount.TotalLaps}`,
      inline: true,
    });
  }

  if (clock?.Remaining) {
    embed.addFields({
      name: '⏳ Remaining',
      value: clock.Remaining,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
