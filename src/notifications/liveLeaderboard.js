import { config } from '../config.js';
import { f1State } from '../state.js';
import { baseEmbed, COLORS, sortDriversByPosition } from '../formatters/utils.js';
import { getLeaderboardGapChartUrl, renderProgressBar } from '../formatters/charts.js';

/**
 * Live Leaderboard — auto-updates a single pinned Discord message
 * Shows current/latest timing data and updates automatically during live sessions
 */
export function setupLiveLeaderboard(client) {
  const channelId = config.channels.liveLeaderboard;
  if (!channelId) {
    console.warn('⚠️  LIVE_LEADERBOARD_CHANNEL_ID not set, skipping live leaderboard');
    return;
  }

  let leaderboardMessageId = null;
  let updateInterval = null;
  let hasPostedInitial = false;

  async function getOrCreateMessage(channel) {
    // Try to reuse tracked message ID
    if (leaderboardMessageId) {
      try {
        return await channel.messages.fetch(leaderboardMessageId);
      } catch {
        leaderboardMessageId = null;
      }
    }

    // Search last 20 messages for an existing bot timing message
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (recent) {
      const existing = recent.find(
        (m) => m.author.id === client.user.id && (m.embeds[0]?.title?.includes('Leaderboard') || m.embeds[0]?.title?.includes('Live Timing'))
      );
      if (existing) {
        leaderboardMessageId = existing.id;
        return existing;
      }
    }

    // Send new message
    const msg = await channel.send({ embeds: [buildLoadingEmbed()] });
    leaderboardMessageId = msg.id;
    return msg;
  }

  async function updateLeaderboard() {
    const timingData = f1State.timingData;
    const driverList = f1State.driverList;
    const sessionInfo = f1State.sessionInfo;
    const sessionStatus = f1State.sessionStatus;
    const lapCount = f1State.lapCount;
    const timingAppData = f1State.timingAppData;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const msg = await getOrCreateMessage(channel).catch(() => null);
    if (!msg) return;

    if (!timingData || !driverList) {
      await msg.edit({ embeds: [buildNoSessionEmbed()] }).catch(() => {});
      return;
    }

    const embed = buildLeaderboardEmbed(
      timingData, driverList, sessionInfo, sessionStatus, lapCount, timingAppData
    );

    await msg.edit({ embeds: [embed] }).catch(console.error);
  }

  // Update when initial snapshot arrives or session updates
  f1State.on('initial', () => {
    if (!hasPostedInitial) {
      hasPostedInitial = true;
      setTimeout(updateLeaderboard, 1000);
    }
  });

  f1State.on('update', (state) => {
    // If not posted initial yet but timing data exists, post now
    if (!hasPostedInitial && f1State.timingData) {
      hasPostedInitial = true;
      updateLeaderboard();
    }

    const status = state?.SessionStatus?.Status;
    const isLive = status === 'Started';

    if (isLive && !updateInterval) {
      console.log('📺 Live timing ticker started (updating every 20s)');
      updateInterval = setInterval(updateLeaderboard, 20_000);
      updateLeaderboard();
    }

    if (!isLive && updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
      console.log('📺 Live timing ticker stopped (session ended)');
      updateLeaderboard(); // Final classification update
    }
  });

  // Attempt initial render after 3s in case state is already populated
  setTimeout(() => {
    if (f1State.timingData && !hasPostedInitial) {
      hasPostedInitial = true;
      updateLeaderboard();
    }
  }, 3000);

  console.log('✅ Live leaderboard & timing board active');
}

function buildLeaderboardEmbed(timingData, driverList, sessionInfo, sessionStatus, lapCount, timingAppData) {
  const sorted = sortDriversByPosition(timingData.Lines);

  const sessionName = sessionInfo
    ? `${sessionInfo.Meeting?.Name} — ${sessionInfo.Name}`
    : 'Live Session';

  const isLive = sessionStatus?.Status === 'Started';
  const badge = isLive ? '🔴 **LIVE TIMING**' : `🏁 **SESSION CLASSIFICATION (${sessionStatus?.Status || 'Finished'})**`;

  let lapText = `${badge}\n`;
  if (lapCount?.CurrentLap && lapCount?.TotalLaps) {
    const cur = parseInt(lapCount.CurrentLap) || 0;
    const tot = parseInt(lapCount.TotalLaps) || 1;
    const bar = renderProgressBar(cur, tot, 12);
    const pct = Math.round((cur / tot) * 100);
    lapText += `🏁 **Lap ${cur}/${tot}** \`${bar}\` **${pct}%**\n`;
  }

  const embed = baseEmbed(`🏎️ F1 Live Timing — ${sessionName}`, isLive ? COLORS.primary : COLORS.info)
    .setDescription(`${lapText}_🔄 Live auto-updating timing screen_`);

  const rows = sorted.slice(0, 20).map((td) => {
    const driver = driverList[td.RacingNumber];
    const tla = driver?.Tla ?? `#${td.RacingNumber}`;
    const pos = String(td.Position || '?').padStart(2);
    const lastLap = td.LastLapTime?.Value || td.BestLapTime?.Value || '—';
    const gap = td.GapToLeader || (td.IntervalToPositionAhead?.Value ? `+${td.IntervalToPositionAhead.Value}` : '—');
    const stint = timingAppData?.Lines?.[td.RacingNumber]?.Stints?.at(-1);
    const tireEmoji = getTireEmoji(stint?.Compound);

    let flag = '';
    if (td.InPit) flag = '🔧';
    else if (td.PitOut) flag = '↗️';
    else if (td.Retired) flag = '❌';
    else if (td.Stopped) flag = '🛑';

    return `\`${pos}\` ${tireEmoji} **${tla}** ${flag}  ⏱\`${lastLap.padEnd(8)}\`  📏\`${gap}\``;
  });

  const half = Math.ceil(rows.length / 2);
  embed.addFields(
    { name: 'P1 — P10', value: rows.slice(0, half).join('\n') || '—', inline: true },
    { name: 'P11 — P20', value: rows.slice(half).join('\n') || '—', inline: true },
  );

  const chartUrl = getLeaderboardGapChartUrl(timingData.Lines, driverList);
  if (chartUrl) {
    embed.setImage(chartUrl);
  }

  return embed;
}

function getTireEmoji(compound) {
  const map = { SOFT: '🔴', MEDIUM: '🟡', HARD: '⚪', INTERMEDIATE: '🟢', WET: '🔵' };
  return map[compound] ?? '⚪';
}

function buildLoadingEmbed() {
  return baseEmbed('🏎️ F1 Live Timing', COLORS.neutral)
    .setDescription('⏳ Connecting to F1 Live Timing stream...');
}

function buildNoSessionEmbed() {
  return baseEmbed('⏸️ No Active Session', COLORS.neutral)
    .setDescription('Waiting for F1 telemetry stream data...');
}
