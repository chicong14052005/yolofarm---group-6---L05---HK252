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

interface EnvironmentChartProps {
  data: DataPoint[];
  label: string;
  unit: string;
  color: string;
}

const EnvironmentChart = ({ data, label, unit, color }: EnvironmentChartProps) => {
  const labels = data.map((d) => {
    const date = new Date(d.time);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: `${label} (${unit})`,
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
        display: false,
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
          label: (ctx) => `${label}: ${ctx.parsed.y ?? 0} ${unit}`,
        },
      },
    },
    scales: {
      x: {
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
      },
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
