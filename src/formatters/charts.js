/**
 * F1 Charts & Visual Representations
 * Generates high-res F1-themed charts via QuickChart and text visual progress bars
 */

const QUICKCHART_BASE = 'https://quickchart.io/chart';
const DEFAULT_BG = '%2315151e'; // F1 dark background #15151e

/**
 * Builds a QuickChart URL from a Chart.js configuration
 */
export function buildChartUrl(chartConfig, width = 600, height = 300) {
  const jsonStr = JSON.stringify(chartConfig);
  return `${QUICKCHART_BASE}?w=${width}&h=${height}&bkg=${DEFAULT_BG}&c=${encodeURIComponent(jsonStr)}`;
}

/**
 * ASCII / Unicode progress bar helper
 * e.g. [████████░░]
 */
export function renderProgressBar(value, max, size = 10, fill = '█', empty = '░') {
  if (max <= 0) return `[${empty.repeat(size)}]`;
  const ratio = Math.max(0, Math.min(1, value / max));
  const filledCount = Math.round(ratio * size);
  const emptyCount = size - filledCount;
  return `[${fill.repeat(filledCount)}${empty.repeat(emptyCount)}]`;
}

/**
 * Generates horizontal bar chart showing gaps to leader for Top 10 drivers
 */
export function getLeaderboardGapChartUrl(timingLines, driverList) {
  if (!timingLines || !driverList) return null;

  const sorted = Object.values(timingLines)
    .sort((a, b) => (parseInt(a.Position) || 99) - (parseInt(b.Position) || 99))
    .slice(0, 10);

  if (sorted.length < 2) return null;

  const labels = [];
  const data = [];
  const colors = [];

  for (let i = 0; i < sorted.length; i++) {
    const td = sorted[i];
    const driver = driverList[td.RacingNumber];
    const tla = driver?.Tla || `#${td.RacingNumber}`;
    labels.push(`P${i + 1} ${tla}`);

    let gapSeconds = 0;
    if (i > 0 && td.GapToLeader) {
      const match = td.GapToLeader.match(/[\d.]+/);
      gapSeconds = match ? parseFloat(match[0]) : 0;
    }
    data.push(gapSeconds);

    const hexColor = driver?.TeamColour ? `#${driver.TeamColour.replace('#', '')}` : '#E10600';
    colors.push(hexColor);
  }

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Top 10 Gap to Leader (seconds)',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
            scaleLabel: { display: true, labelString: 'Seconds behind leader (+s)', fontColor: '#888' },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#ffffff', fontStyle: 'bold' },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 600, 320);
}

/**
 * Generates Driver Standings Points chart
 */
export function getDriverStandingsChartUrl(drivers) {
  if (!drivers || !drivers.length) return null;
  const top10 = drivers.slice(0, 10);
  const labels = top10.map((d) => `P${d.position} ${d.tla}`);
  const points = top10.map((d) => d.points);
  const colors = top10.map((d) => d.teamColour || '#E10600');

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          data: points,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'F1 World Championship: Driver Standings (Points)',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
            scaleLabel: { display: true, labelString: 'Points', fontColor: '#888' },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#ffffff', fontStyle: 'bold' },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 600, 320);
}

/**
 * Generates Constructors / Team Standings Points chart
 */
export function getTeamStandingsChartUrl(teams) {
  if (!teams || !teams.length) return null;
  const top10 = teams.slice(0, 10);
  const labels = top10.map((t) => `P${t.position} ${t.teamName}`);
  const points = top10.map((t) => t.points);

  const TEAM_COLORS = {
    'Mercedes': '#00D7B6',
    'Ferrari': '#E80020',
    'McLaren': '#F47600',
    'Red Bull Racing': '#3671C6',
    'Aston Martin': '#229971',
    'Alpine': '#FF87BC',
    'Williams': '#64C4FF',
    'Racing Bulls': '#6692FF',
    'Kick Sauber': '#52E252',
    'Haas F1 Team': '#B6BABD',
  };

  const colors = top10.map((t) => TEAM_COLORS[t.teamName] || '#E10600');

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          data: points,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'F1 World Championship: Constructors Standings',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
            scaleLabel: { display: true, labelString: 'Championship Points', fontColor: '#888' },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#ffffff', fontStyle: 'bold' },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 600, 320);
}

/**
 * Generates Championship Points chart (Top 10 Drivers or Top 10 Teams)
 */
export function getChampionshipChartUrl(prediction, driverList) {
  if (Array.isArray(prediction)) {
    return getDriverStandingsChartUrl(prediction);
  }
  if (!prediction?.Drivers) return null;

  const drivers = Object.values(prediction.Drivers)
    .sort((a, b) => a.PredictedPosition - b.PredictedPosition)
    .slice(0, 10);

  if (!drivers.length) return null;

  const labels = [];
  const points = [];
  const colors = [];

  for (const d of drivers) {
    const driver = driverList?.[d.RacingNumber];
    const tla = driver?.Tla || `#${d.RacingNumber}`;
    labels.push(`P${d.PredictedPosition} ${tla}`);
    points.push(d.PredictedPoints);

    const hexColor = driver?.TeamColour ? `#${driver.TeamColour.replace('#', '')}` : '#E10600';
    colors.push(hexColor);
  }

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          data: points,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Drivers Championship Predicted Standings (Pts)',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
            scaleLabel: { display: true, labelString: 'Championship Points', fontColor: '#888' },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#ffffff', fontStyle: 'bold' },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 600, 320);
}

/**
 * Generates Tire Compound Distribution Donut Chart
 */
export function getTireDonutChartUrl(timingAppData) {
  if (!timingAppData?.Lines) return null;

  const counts = { SOFT: 0, MEDIUM: 0, HARD: 0, INTERMEDIATE: 0, WET: 0, UNKNOWN: 0 };

  for (const driverNum of Object.keys(timingAppData.Lines)) {
    const appData = timingAppData.Lines[driverNum];
    const stint = appData?.Stints?.at(-1);
    const compound = (stint?.Compound || 'UNKNOWN').toUpperCase();
    if (counts[compound] != null) {
      counts[compound]++;
    } else {
      counts.UNKNOWN++;
    }
  }

  const labels = [];
  const data = [];
  const colors = [];

  const COMPOUND_COLORS = {
    SOFT: '#E10600',
    MEDIUM: '#FFD200',
    HARD: '#FFFFFF',
    INTERMEDIATE: '#39B54A',
    WET: '#00A3E0',
    UNKNOWN: '#71717A',
  };

  for (const [key, count] of Object.entries(counts)) {
    if (count > 0) {
      labels.push(`${key} (${count})`);
      data.push(count);
      colors.push(COMPOUND_COLORS[key] || '#71717A');
    }
  }

  if (!data.length) return null;

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: '#15151e',
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: 'right',
          labels: { fontColor: '#ffffff', fontStyle: 'bold', boxWidth: 15 },
        },
        title: {
          display: true,
          text: 'Grid Tire Compound Distribution',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
    },
  };

  return buildChartUrl(chartConfig, 500, 260);
}

/**
 * Generates Weather Telemetry Bar Chart
 */
export function getWeatherChartUrl(weather) {
  if (!weather) return null;

  const airTemp = parseFloat(weather.AirTemp) || 0;
  const trackTemp = parseFloat(weather.TrackTemp) || 0;
  const humidity = parseFloat(weather.Humidity) || 0;
  const windSpeed = parseFloat(weather.WindSpeed) || 0;

  const chartConfig = {
    type: 'bar',
    data: {
      labels: ['Air Temp (°C)', 'Track Temp (°C)', 'Humidity (%)', 'Wind (m/s)'],
      datasets: [
        {
          data: [airTemp, trackTemp, humidity, windSpeed],
          backgroundColor: ['#38BDF8', '#EF4444', '#3B82F6', '#A855F7'],
          borderRadius: 6,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Track Environmental Telemetry',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#ffffff', fontStyle: 'bold' },
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 550, 280);
}

/**
 * Generates Driver Sector Times Bar Chart
 */
export function getDriverSectorChartUrl(driver, timingData, driverList) {
  if (!driver || !timingData?.Lines) return null;

  const td = timingData.Lines[driver.RacingNumber];
  if (!td?.Sectors || td.Sectors.length < 3) return null;

  const parseSec = (val) => {
    if (!val) return 0;
    const m = String(val).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  };

  const dS1 = parseSec(td.Sectors[0]?.Value);
  const dS2 = parseSec(td.Sectors[1]?.Value);
  const dS3 = parseSec(td.Sectors[2]?.Value);

  if (!dS1 && !dS2 && !dS3) return null;

  // Find best sectors across all drivers
  let bestS1 = dS1;
  let bestS2 = dS2;
  let bestS3 = dS3;

  for (const line of Object.values(timingData.Lines)) {
    if (!line.Sectors) continue;
    const s1 = parseSec(line.Sectors[0]?.Value);
    const s2 = parseSec(line.Sectors[1]?.Value);
    const s3 = parseSec(line.Sectors[2]?.Value);
    if (s1 && (!bestS1 || s1 < bestS1)) bestS1 = s1;
    if (s2 && (!bestS2 || s2 < bestS2)) bestS2 = s2;
    if (s3 && (!bestS3 || s3 < bestS3)) bestS3 = s3;
  }

  const teamColor = driver.TeamColour ? `#${driver.TeamColour.replace('#', '')}` : '#E10600';

  const chartConfig = {
    type: 'bar',
    data: {
      labels: ['Sector 1', 'Sector 2', 'Sector 3'],
      datasets: [
        {
          label: driver.Tla || `#${driver.RacingNumber}`,
          data: [dS1, dS2, dS3],
          backgroundColor: teamColor,
          borderRadius: 4,
        },
        {
          label: 'Session Best (Purple)',
          data: [bestS1, bestS2, bestS3],
          backgroundColor: '#A855F7',
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: { fontColor: '#ffffff' },
        },
        title: {
          display: true,
          text: `Sector Times Comparison: ${driver.Tla} vs Session Best (s)`,
          color: '#ffffff',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: '#ffffff' },
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: '#aaaaaa' },
            gridLines: { color: '#2a2b36' },
            scaleLabel: { display: true, labelString: 'Time (seconds)', fontColor: '#888' },
          },
        ],
      },
    },
  };

  return buildChartUrl(chartConfig, 550, 280);
}
