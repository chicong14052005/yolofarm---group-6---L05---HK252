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
  historicalPredictions?: DataPoint[];
  forecastData?: ForecastPoint[];
  label: string;
  unit: string;
  color: string;
  showDateLabels?: boolean;
}

const EnvironmentChart = ({
  data,
  historicalPredictions = [],
  forecastData = [],
  label,
  unit,
  color,
  showDateLabels = false,
}: EnvironmentChartProps) => {
  const allPoints = [...data, ...historicalPredictions, ...forecastData]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const labels = allPoints.map((d) => {
    const date = new Date(d.time);
    if (showDateLabels) {
      const day = date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `${day}\n${time}`;
    }
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  const observedMap = new Map(data.map((d) => [d.time, d.value]));
  const historicalMap = new Map(historicalPredictions.map((d) => [d.time, d.value]));
  const forecastMap = new Map(forecastData.map((d) => [d.time, d.value]));
  const lowerMap = new Map(forecastData.map((d) => [d.time, d.lower]));
  const upperMap = new Map(forecastData.map((d) => [d.time, d.upper]));

  const orderedTimes = allPoints.map((d) => d.time);
  const values = orderedTimes.map((t) => observedMap.get(t) ?? null);
  const historicalValues = orderedTimes.map((t) => historicalMap.get(t) ?? null);
  const forecastValues = orderedTimes.map((t) => forecastMap.get(t) ?? null);
  const lowerValues = orderedTimes.map((t) => lowerMap.get(t) ?? null);
  const upperValues = orderedTimes.map((t) => upperMap.get(t) ?? null);

  const hasHistorical = historicalPredictions.length > 0;
  const hasForecast = forecastData.length > 0;
  const showLegend = hasHistorical || hasForecast;

  const xScale = showDateLabels
    ? {
        ticks: {
          color: 'rgba(148, 163, 184, 0.7)',
          font: { size: 10 },
          maxTicksLimit: 10,
          maxRotation: 0,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        border: { display: false },
      }
    : {
        ticks: {
          color: 'rgba(148, 163, 184, 0.7)',
          font: { size: 10 },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        border: { display: false },
      };

  const chartData = {
    labels,
    datasets: [
      {
        label: `${label} thực tế (${unit})`,
        data: values,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        borderWidth: 2.5,
      },
      ...(hasHistorical
        ? [
            {
              label: `${label} dự đoán (${unit})`,
              data: historicalValues,
              borderColor: color,
              backgroundColor: 'transparent',
              borderDash: [4, 3],
              fill: false,
              tension: 0.35,
              pointRadius: 0,
              borderWidth: 1.5,
            },
          ]
        : []),
      ...(hasForecast
        ? [
            {
              label: `${label} dự báo (${unit})`,
              data: forecastValues,
              borderColor: color,
              backgroundColor: 'transparent',
              borderDash: [6, 4],
              fill: false,
              tension: 0.35,
              pointRadius: 0,
              borderWidth: 2,
            },
            {
              label: 'Upper bound',
              data: upperValues,
              borderColor: 'transparent',
              backgroundColor: 'transparent',
              pointRadius: 0,
              fill: false,
            },
            {
              label: 'Confidence interval',
              data: lowerValues,
              borderColor: 'transparent',
              backgroundColor: `${color}1f`,
              pointRadius: 0,
              fill: '-1' as const,
            },
          ]
        : []),
    ],
  };

  const options: React.ComponentProps<typeof Line>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: showLegend,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#e2e8f0',
        borderColor: color,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === 'Confidence interval' || ctx.dataset.label === 'Upper bound') {
              return '';
            }
            return `${ctx.dataset.label || label}: ${ctx.parsed.y ?? 0} ${unit}`;
          },
        },
      },
    },
    scales: {
      x: xScale,
      y: {
        ticks: {
          color: 'rgba(148, 163, 184, 0.7)',
          font: { size: 10 },
          padding: 8,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '220px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default EnvironmentChart;
