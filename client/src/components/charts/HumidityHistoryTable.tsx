import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import aiService from '../../services/aiService';
import type { HumidityWeeklySummaryRow } from '../../types/ai';
import { formatLocalDateKey } from '../../utils/timeUtils';
import './HumidityHistoryTable.css';

const STATUS_KEYS: Record<HumidityWeeklySummaryRow['status'], string> = {
  low: 'dashboard.statusLow',
  optimal: 'dashboard.statusOptimal',
  high: 'dashboard.statusHigh',
  missing: 'dashboard.statusMissing',
};

const MISSING_REASON_KEYS: Record<NonNullable<HumidityWeeklySummaryRow['missing_reason']>, string> = {
  no_forecast_cache: 'dashboard.missingNoForecastCache',
  no_forecast_history: 'dashboard.missingNoForecastHistory',
  no_historical_prediction: 'dashboard.missingNoHistoricalPrediction',
  no_actual_data: 'dashboard.missingNoActualData',
  no_historical_prediction_for_day: 'dashboard.missingNoHistoricalPredictionForDay',
};

const formatPercent = (value: number | null) => (
  value === null ? '--' : `${Number(value).toFixed(2)}%`
);

const formatVariance = (value: number | null) => {
  if (value === null) return '--';
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
};

const formatDisplayDate = (dateText: string) => {
  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateText
    : date.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
};

const escapeCsv = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const HumidityHistoryTable = () => {
  const { t } = useLanguage();
  const [rows, setRows] = useState<HumidityWeeklySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    aiService.getHumidityWeeklySummary(7)
      .then((summary) => {
        if (!active) return;
        setRows(summary.rows || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.error || err?.message || 'Failed to load humidity history');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const csvContent = useMemo(() => {
    const headers = [
      'Date',
      'Actual Humidity (%)',
      'Backtest Predicted Humidity (%)',
      'Variance',
      'Status',
      'Missing reason',
    ];
    const lines = rows.map((row) => [
      row.date,
      row.actual_avg,
      row.predicted_avg,
      row.variance,
      t(STATUS_KEYS[row.status]),
      row.missing_reason ? t(MISSING_REASON_KEYS[row.missing_reason]) : '',
    ].map(escapeCsv).join(','));

    return `\uFEFF${headers.map(escapeCsv).join(',')}\n${lines.join('\n')}`;
  }, [rows, t]);

  const exportCsv = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `humidity-history-${formatLocalDateKey()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="humidity-history-card card animate-fadeInUp">
      <div className="humidity-history-header">
        <div>
          <h3>{t('dashboard.humidityHistory')}</h3>
          <p>{t('dashboard.humidityHistorySubtitle')}</p>
        </div>
        <button
          type="button"
          className="humidity-export-btn"
          onClick={exportCsv}
          disabled={loading || rows.length === 0}
        >
          <span className="material-symbols-outlined">download</span>
          {t('dashboard.exportCsv')}
        </button>
      </div>

      {loading ? (
        <div className="humidity-history-state">
          <div className="carousel-spinner" />
        </div>
      ) : error ? (
        <div className="humidity-history-state error">{error}</div>
      ) : (
        <div className="humidity-history-table-wrap">
          <table className="humidity-history-table">
            <thead>
              <tr>
                <th>{t('dashboard.date')}</th>
                <th>{t('dashboard.actualHumidity')}</th>
                <th>{t('dashboard.predictedHumidity')}</th>
                <th>{t('dashboard.variance')}</th>
                <th>{t('dashboard.status')}</th>
                <th>{t('dashboard.missingReason')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{formatDisplayDate(row.date)}</td>
                  <td>{formatPercent(row.actual_avg)}</td>
                  <td>{formatPercent(row.predicted_avg)}</td>
                  <td className={row.variance !== null && row.variance > 0 ? 'positive' : row.variance !== null && row.variance < 0 ? 'negative' : ''}>
                    {formatVariance(row.variance)}
                  </td>
                  <td>
                    <span className={`humidity-status-pill ${row.status}`}>
                      {t(STATUS_KEYS[row.status])}
                    </span>
                  </td>
                  <td className="missing-reason-cell">
                    {row.missing_reason ? t(MISSING_REASON_KEYS[row.missing_reason]) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default HumidityHistoryTable;
