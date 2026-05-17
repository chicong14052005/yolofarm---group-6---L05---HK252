import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import aiService from '../../services/aiService';
import type { DiseaseDetectionResult } from '../../types/ai';
import { HiOutlineUpload, HiOutlineClock } from 'react-icons/hi';
import '../../pages/DashboardPage/DashboardPage.css';
import './AIPage.css';

const AIPage = () => {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await aiService.detectDisease(file);
      setResult(data);
    } catch (err) {
      setError('Dịch vụ nhận diện hiện không khả dụng. Vui lòng thử lại sau.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.png', '.jpeg'] }, maxFiles: 1,
  });

  const confidencePercent = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('ai.title')}</h1>
            <p className="page-subtitle">{t('ai.subtitle')}</p>
          </div>
        </header>

        <div className="ai-layout">
          <div className="ai-left">
            <div className="card upload-card">
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} disabled={loading} />
                <HiOutlineUpload className="upload-icon" />
                <h3>{t('ai.dragDrop')}</h3>
                <p>{t('ai.dragDropDesc')}</p>
                <button className="btn btn-primary" type="button" disabled={loading}>
                  {loading ? 'Đang xử lý...' : t('ai.selectImage')}
                </button>
              </div>
            </div>

            {error && (
              <div className="card detection-card animate-fadeInUp">
                <div className="detection-body" style={{ justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--danger)', marginBottom: '1rem' }}>error</span>
                  <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                </div>
              </div>
            )}

            {result && result.disease_name && result.disease_name !== 'unknown' && (
              <div className="card detection-card animate-fadeInUp">
                <div className="detection-header">
                  <h3>{t('ai.detectionDetails')}</h3>
                  <span className="scan-time"><HiOutlineClock /> {t('ai.scannedAgo')} 2 min</span>
                </div>
                <div className="detection-body">
                  {preview && <img src={preview} alt="Scanned" className="scanned-image" />}
                  <div className="detection-info">
                    <div className="confidence-ring">
                      <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="6"
                          strokeDasharray={`${confidencePercent * 2.64} 264`} strokeLinecap="round"
                          transform="rotate(-90 50 50)" />
                        <text x="50" y="45" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text-primary)">{confidencePercent}%</text>
                        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)">{t('ai.match')}</text>
                      </svg>
                    </div>
                    <div>
                      <h2>{result.disease_name}</h2>
                      <span className={`badge ${result.threat_level === 'high' ? 'badge-danger' : result.threat_level === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                        {result.threat_level === 'high' ? 'Active Threat Level: ' : 'Threat Level: '}{result.threat_level}
                      </span>
                      <div className="detail-rows">
                        <div><span>{t('ai.cropType')}</span><strong>{result.crop_type}</strong></div>
                        {result.pest_common_name !== 'unknown' && (
                          <div><span>{t('ai.pestName')}</span><strong>{result.pest_common_name}</strong></div>
                        )}
                        {result.estimated_count && (
                          <div><span>{t('ai.estimatedCount')}</span><strong className="text-danger">{result.estimated_count}</strong></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result && result.disease_name === 'unknown' && !error && (
              <div className="card detection-card animate-fadeInUp">
                <div className="detection-body" style={{ justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--warning)', marginBottom: '1rem' }}>info</span>
                  <p style={{ color: 'var(--text-muted)' }}>{result.description || 'Dịch vụ nhận diện chưa được kết nối.'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="ai-right">
            <div className="card treatments-card">
              <h3>{t('ai.recommendedTreatments')}</h3>
              {(result?.treatments || []).length > 0 ? (
                (result!.treatments).map((tr, i) => (
                  <div key={i} className="treatment-item">
                    <h4>{tr.name}</h4>
                    <span className="badge badge-success">{tr.type}</span>
                    <p>{tr.description}</p>
                    <div className="treatment-footer">
                      <span className="efficacy">{tr.efficacy}% {t('ai.efficacy')}</span>
                      <button className="btn btn-secondary btn-sm">{t('ai.viewGuide')}</button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-text">
                  {loading ? 'Đang xử lý...' : error ? 'Không thể tải thông tin điều trị.' : t('ai.uploadHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIPage;
