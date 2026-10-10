import { SlashCommandBuilder } from 'discord.js';
import { execute as championshipExecute } from './championship.js';

export const data = new SlashCommandBuilder()
  .setName('standings')
  .setDescription('🏆 Bảng xếp hạng tay đua & đội đua F1 thế giới (Driver & Constructor Standings)')
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
  return championshipExecute(interaction);
}
