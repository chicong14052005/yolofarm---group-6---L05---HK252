import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineUpload, HiOutlineClock } from 'react-icons/hi';
import '../../pages/DashboardPage/DashboardPage.css';
import './AIPage.css';

const AIPage = () => {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setResult({
        disease: 'Aphid Infestation', confidence: 94,
        threat: 'High', crop: 'Tomato (Lycopersicon)',
        pest: 'Green Peach Aphid', count: '~240 individuals',
        treatments: [
          { name: 'Neem Oil Spray', type: 'ORGANIC', desc: 'Mix 2 tbsps of neem oil with mild soap in a gallon of water.', efficacy: 98 },
          { name: 'Ladybug Introduction', type: 'BIOLOGICAL CONTROL', desc: 'Introduce Hippodamia convergens to your greenhouse.', efficacy: 85 },
        ]
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.png', '.jpeg'] }, maxFiles: 1
  });

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
                <input {...getInputProps()} />
                <HiOutlineUpload className="upload-icon" />
                <h3>{t('ai.dragDrop')}</h3>
                <p>{t('ai.dragDropDesc')}</p>
                <button className="btn btn-primary" type="button">{t('ai.selectImage')}</button>
              </div>
            </div>

            {result && (
              <div className="card detection-card animate-fadeInUp">
                <div className="detection-header">
                  <h3>🔬 {t('ai.detectionDetails')}</h3>
                  <span className="scan-time"><HiOutlineClock /> {t('ai.scannedAgo')} 2 min</span>
                </div>
                <div className="detection-body">
                  {preview && <img src={preview} alt="Scanned" className="scanned-image" />}
                  <div className="detection-info">
                    <div className="confidence-ring">
                      <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="6"
                          strokeDasharray={`${result.confidence * 2.64} 264`} strokeLinecap="round"
                          transform="rotate(-90 50 50)" />
                        <text x="50" y="45" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text-primary)">{result.confidence}%</text>
                        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)">{t('ai.match')}</text>
                      </svg>
                    </div>
                    <div>
                      <h2>{result.disease}</h2>
                      <span className="badge badge-danger">Active Threat Level: {result.threat}</span>
                      <div className="detail-rows">
                        <div><span>{t('ai.cropType')}</span><strong>{result.crop}</strong></div>
                        <div><span>{t('ai.pestName')}</span><strong>{result.pest}</strong></div>
                        <div><span>{t('ai.estimatedCount')}</span><strong className="text-danger">{result.count}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ai-right">
            <div className="card treatments-card">
              <h3>🌿 {t('ai.recommendedTreatments')}</h3>
              {(result?.treatments || []).map((tr: any, i: number) => (
                <div key={i} className="treatment-item">
                  <h4>{tr.name}</h4>
                  <span className="badge badge-success">{tr.type}</span>
                  <p>{tr.desc}</p>
                  <div className="treatment-footer">
                    <span className="efficacy">{tr.efficacy}% {t('ai.efficacy')}</span>
                    <button className="btn btn-secondary btn-sm">{t('ai.viewGuide')}</button>
                  </div>
                </div>
              ))}
              {!result && <p className="empty-text">{t('ai.uploadHint')}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIPage;
