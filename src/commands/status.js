import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS } from '../formatters/utils.js';
import { getConnectionStatus } from '../f1Client.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('📡 Show bot connection and session status');

export async function execute(interaction) {
  await interaction.deferReply();

  const connected = getConnectionStatus();
  const sessionInfo = f1State.sessionInfo;
  const sessionStatus = f1State.sessionStatus;

  const embed = baseEmbed('📡 Bot Status', COLORS.info)
    .addFields(
      {
        name: '🔴 F1 Official Live Timing',
        value: connected ? '🟢 Connected (SignalR Core)' : '🔴 Disconnected',
        inline: true,
      },
      {
        name: '🗓️ Calendar Service',
        value: '🟢 Active (Direct F1 Feed)',
        inline: true,
      },
      {
        name: '🏎️ Active Session',
        value: sessionInfo
          ? `✅ **${sessionInfo.Meeting?.Name || 'Unknown'}** — ${sessionInfo.Name || 'Live'}`
          : '⏸️ No session active',
        inline: false,
      },
    );

  if (sessionStatus?.Status) {
    embed.addFields({
      name: '📌 Session Status',
      value: sessionStatus.Status,
      inline: true,
    });
  }

  if (sessionInfo?.Meeting?.Circuit?.ShortName) {
    embed.addFields({
      name: '🏁 Circuit',
      value: sessionInfo.Meeting.Circuit.ShortName,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
