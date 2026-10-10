import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, getTrackStatus, noSessionEmbed } from '../formatters/utils.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('track-status')
  .setDescription('🛣️ Show current track status (flags, safety car, etc.)');

export async function execute(interaction) {
  await interaction.deferReply();

  const trackStatus = f1State.trackStatus;
  const sessionInfo = f1State.sessionInfo;

  if (!trackStatus) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const ts = getTrackStatus(trackStatus.Status);
  const sessionName = sessionInfo?.Meeting?.Name ?? 'Track';

  const embed = baseEmbed(`🛣️ Track Status — ${sessionName}`, ts.color)
    .setDescription(`## ${ts.emoji} ${ts.label}`)
    .addFields({
      name: '📢 Message',
      value: trackStatus.Message || ts.label,
      inline: false,
    });

  await interaction.editReply({ embeds: [embed] });
}
