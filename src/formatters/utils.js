import { EmbedBuilder } from 'discord.js';

// ── Tire emojis ──────────────────────────────────────────────────────────────
export const TIRE_EMOJI = {
  SOFT: '🔴',
  MEDIUM: '🟡',
  HARD: '⚪',
  INTERMEDIATE: '🟢',
  WET: '🔵',
};

// ── Flag emojis ──────────────────────────────────────────────────────────────
export const FLAG_EMOJI = {
  'RED': '🚩',
  'YELLOW': '🟡',
  'DOUBLE YELLOW': '🟡🟡',
  'GREEN': '🟢',
  'BLUE': '🔵',
  'CHEQUERED': '🏁',
  'BLACK AND WHITE': '⬛⬜',
  'CLEAR': '✅',
};

// ── Track status ─────────────────────────────────────────────────────────────
const TRACK_STATUS_MAP = {
  '1': { label: 'All Clear',        emoji: '🟢', color: 0x22c55e },
  '2': { label: 'Yellow Flag',      emoji: '🟡', color: 0xeab308 },
  '3': { label: 'Flag',             emoji: '🏴', color: 0xa1a1aa },
  '4': { label: 'Safety Car',       emoji: '🚗', color: 0xf97316 },
  '5': { label: 'Red Flag',         emoji: '🚩', color: 0xef4444 },
  '6': { label: 'Virtual Safety Car', emoji: '🟠', color: 0xf97316 },
  '7': { label: 'VSC Ending',       emoji: '🟠', color: 0xf97316 },
};

export function getTrackStatus(status) {
  return TRACK_STATUS_MAP[status] ?? { label: status, emoji: '❓', color: 0x71717a };
}

// ── Colors ───────────────────────────────────────────────────────────────────
export const COLORS = {
  primary:  0xe10600,  // F1 red
  success:  0x22c55e,
  warning:  0xeab308,
  danger:   0xef4444,
  neutral:  0x3f3f46,
  info:     0x3b82f6,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format team hex color string → Discord integer color */
export function teamColor(hex) {
  if (!hex) return COLORS.neutral;
  return parseInt(hex.replace('#', ''), 16) || COLORS.neutral;
}

/** Format a duration string HH:MM:SS.mmm */
export function formatTime(value) {
  if (!value || value === '') return '-';
  return value;
}

/** Format gap (e.g. "+1.234" → "+1.234s" or "1 lap") */
export function formatGap(gap) {
  if (!gap || gap === '') return '-';
  if (gap.startsWith('+') || gap.startsWith('-')) return `${gap}s`;
  return gap;
}

/** Get tire display string */
export function formatTire(stint) {
  if (!stint) return '❓ Unknown';
  const emoji = TIRE_EMOJI[stint.Compound] ?? '❓';
  const isNew = stint.New === 'TRUE' ? 'NEW' : 'USED';
  const laps = stint.TotalLaps != null ? `${stint.TotalLaps}L` : '';
  return `${emoji} ${stint.Compound ?? '?'} (${isNew}${laps ? ', ' + laps : ''})`;
}

/** Sort drivers by position */
export function sortDriversByPosition(timingLines) {
  return Object.values(timingLines).sort((a, b) => {
    const posA = parseInt(a.Position) || 99;
    const posB = parseInt(b.Position) || 99;
    return posA - posB;
  });
}

/** Format position medal */
export function positionMedal(pos) {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `P${pos}`;
}

/** Format UTC timestamp to readable local time */
export function formatUtc(utc, gmtOffset = '+00:00') {
  try {
    const date = new Date(utc);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return utc;
  }
}

/** Base F1 embed */
export function baseEmbed(title, color = COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: 'f1-dash bot • Data: F1 Live Timing' })
    .setTimestamp();
}

/** No session embed */
export function noSessionEmbed() {
  return baseEmbed('⏸️ No Active Session', COLORS.neutral)
    .setDescription('There is no live F1 session at the moment.\nUse `/next-race` to see upcoming events.');
}
