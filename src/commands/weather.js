import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, COLORS, noSessionEmbed } from '../formatters/utils.js';
import { getWeatherChartUrl, renderProgressBar } from '../formatters/charts.js';
import { f1State } from '../state.js';

export const data = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('🌤️ Show current track weather conditions and telemetry chart');

export async function execute(interaction) {
  await interaction.deferReply();

  const weather = f1State.weatherData;
  const sessionInfo = f1State.sessionInfo;

  if (!weather) {
    return interaction.editReply({ embeds: [noSessionEmbed()] });
  }

  const isRaining = weather.Rainfall === '1' || parseFloat(weather.Rainfall) > 0;
  const windDir = getWindDirectionLabel(parseInt(weather.WindDirection));
  const sessionName = sessionInfo?.Meeting?.Name ?? 'Track';

  const airT = parseFloat(weather.AirTemp) || 0;
  const trackT = parseFloat(weather.TrackTemp) || 0;
  const humidity = parseFloat(weather.Humidity) || 0;

  const humidityBar = renderProgressBar(humidity, 100, 8);
  const trackBar = renderProgressBar(trackT, 60, 8);

  const embed = baseEmbed(`🌤️ Track Weather & Telemetry — ${sessionName}`, COLORS.info)
    .addFields(
      {
        name: '🌡️ Air Temp',
        value: `**${airT.toFixed(1)}°C**`,
        inline: true,
      },
      {
        name: '🛣️ Track Temp',
        value: `**${trackT.toFixed(1)}°C**\n\`${trackBar}\``,
        inline: true,
      },
      {
        name: '💧 Humidity',
        value: `**${humidity.toFixed(0)}%**\n\`${humidityBar}\``,
        inline: true,
      },
      {
        name: '💨 Wind Speed',
        value: `**${(parseFloat(weather.WindSpeed) || 0).toFixed(1)} m/s**`,
        inline: true,
      },
      {
        name: '🧭 Wind Direction',
        value: windDir,
        inline: true,
      },
      {
        name: '🌧️ Rainfall',
        value: isRaining ? '☔ **Raining**' : '☀️ **Dry**',
        inline: true,
      },
      {
        name: '📊 Air Pressure',
        value: `${(parseFloat(weather.Pressure) || 0).toFixed(1)} mbar`,
        inline: true,
      },
    );

  // Attach Weather Telemetry Chart
  const chartUrl = getWeatherChartUrl(weather);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}

function getWindDirectionLabel(degrees) {
  if (isNaN(degrees)) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(degrees / 22.5) % 16;
  return `${degrees}° (${dirs[idx]})`;
}
