import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  formatMinuteLabel,
  minutesSinceStartOfDay,
  normalizeYoloFarmTimestamp,
} from '../../utils/timeUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DataPoint {
  time: string;
  value: number;
}

interface ForecastPoint {
  time: string;
  value: number;
  lower: number;
  upper: number;
}

interface EnvironmentChartProps {
  data: DataPoint[];
  forecastData?: ForecastPoint[];
  label: string;
  unit: string;
  color: string;
  isHumidityChart?: boolean;
}

function toChartPoint(point: DataPoint) {
  return {
    x: minutesSinceStartOfDay(normalizeYoloFarmTimestamp(point.time)),
    y: point.value,
  };
}

const FORECAST_COLOR = '#f97316';
const UPPER_BOUND_COLOR = '#f59e0b';
const CONFIDENCE_FILL = 'rgba(249, 115, 22, 0.14)';

const EnvironmentChart = ({
  data,
  forecastData = [],
  label,
  unit,
  color,
  isHumidityChart = false,
}: EnvironmentChartProps) => {
  const {
    actualPoints,
    forecastPoints,
    lowerPoints,
    upperPoints,
    hasForecast,
  } = useMemo(() => {
    const forecast = forecastData.map((point) => ({
      ...point,
      time: normalizeYoloFarmTimestamp(point.time),
    }));

    return {
      actualPoints: data.map((point) => toChartPoint(point)),
      forecastPoints: forecast.map((point) => toChartPoint(point)),
      lowerPoints: forecast.map((point) => ({
        x: minutesSinceStartOfDay(point.time),
        y: point.lower,
      })),
      upperPoints: forecast.map((point) => ({
        x: minutesSinceStartOfDay(point.time),
        y: point.upper,
      })),
      hasForecast: forecast.length > 0,
    };
  }, [data, forecastData]);

  const actualColor = isHumidityChart ? '#2563eb' : color;

  const chartData = useMemo(() => ({
    datasets: [
      {
        label: `${label} thực tế (${unit})`,
        data: actualPoints,
        borderColor: actualColor,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        pointHitRadius: 10,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: actualColor,
        pointBorderWidth: 1,
        pointBorderColor: actualColor,
        borderWidth: 2.5,
      },
      ...(hasForecast
        ? [
            {
              label: `${label} dự báo (${unit})`,
              data: forecastPoints,
              borderColor: FORECAST_COLOR,
              backgroundColor: 'transparent',
              borderDash: [8, 5],
              fill: false,
              tension: 0.35,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: FORECAST_COLOR,
              borderWidth: 2.25,
            },
            {
              label: 'Upper bound',
              data: upperPoints,
              borderColor: UPPER_BOUND_COLOR,
              backgroundColor: 'transparent',
              borderDash: [3, 4],
              fill: false,
              tension: 0.35,
              pointRadius: 0,
              borderWidth: 1.5,
            },
            {
              label: 'Confidence interval',
              data: lowerPoints,
              borderColor: 'transparent',
              backgroundColor: CONFIDENCE_FILL,
              pointRadius: 0,
              fill: '-1' as const,
              tension: 0.35,
            },
          ]
        : []),
    ],
  }), [
    actualColor,
    actualPoints,
    forecastPoints,
    hasForecast,
    label,
    lowerPoints,
    unit,
    upperPoints,
  ]);

  const options: React.ComponentProps<typeof Line>['options'] = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: isHumidityChart || hasForecast,
        labels: {
          color: 'rgba(148, 163, 184, 0.86)',
          boxWidth: 34,
          boxHeight: 10,
          usePointStyle: false,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#e2e8f0',
        bodyColor: '#e2e8f0',
        borderColor: isHumidityChart ? FORECAST_COLOR : color,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (items) => {
            const minute = Number(items[0]?.parsed.x ?? 0);
            return formatMinuteLabel(minute);
          },
          label: (ctx) => {
            if (ctx.parsed.y === null || Number.isNaN(ctx.parsed.y)) return '';
            return `${ctx.dataset.label || label}: ${Number(ctx.parsed.y).toFixed(2)} ${unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: 0,
        max: 1439,
        ticks: {
          color: 'rgba(148, 163, 184, 0.72)',
          font: { size: 10 },
          maxTicksLimit: 9,
          callback: (value) => formatMinuteLabel(Number(value)),
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        border: { display: false },
      },
      y: {
        min: isHumidityChart ? 0 : undefined,
        max: isHumidityChart ? 100 : undefined,
        ticks: {
          color: 'rgba(148, 163, 184, 0.72)',
          font: { size: 10 },
          padding: 8,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        border: { display: false },
      },
    },
  }), [color, hasForecast, isHumidityChart, label, unit]);

  return (
    <div style={{ width: '100%', height: '220px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default EnvironmentChart;
