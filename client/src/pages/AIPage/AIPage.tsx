import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import aiService from '../../services/aiService';
import { HiOutlineUpload, HiOutlineClock } from 'react-icons/hi';
import type { DiseaseDetectionData } from '../../types/ai';
import '../../pages/DashboardPage/DashboardPage.css';
import './AIPage.css';

/** Trả về màu cho vòng tròn confidence */
const getConfidenceColor = (conf: number) => {
  if (conf >= 80) return 'var(--success, #22c55e)';
  if (conf >= 50) return 'var(--warning, #f59e0b)';
  return 'var(--danger, #ef4444)';
};

const AIPage = () => {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseDetectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await aiService.detectDisease(file);
      if (response.success && response.data) {
        setResult(response.data);
      } else {
        throw new Error('Không nhận được kết quả từ mô hình AI');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = axiosErr.response?.data?.error || axiosErr.message || 'Lỗi khi phân tích ảnh';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.png', '.jpeg'] }, maxFiles: 1,
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
            {/* ── Upload Area ── */}
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

            {/* ── Loading State ── */}
            {loading && (
              <div className="card detection-card animate-fadeInUp">
                <div className="loading-container">
                  <div className="spinner" />
                  <p className="loading-text">Đang phân tích hình ảnh...</p>
                  <p className="loading-subtext">Mô hình AI đang xử lý, vui lòng đợi</p>
                </div>
              </div>
            )}

            {/* ── Error State ── */}
            {error && !loading && (
              <div className="card detection-card animate-fadeInUp">
                <div className="error-container">
                  <span className="error-icon">⚠️</span>
                  <h3>Phát hiện lỗi</h3>
                  <p>{error}</p>
                  <button className="btn btn-primary" onClick={() => setError(null)}>Thử lại</button>
                </div>
              </div>
            )}

            {/* ── Detection Result ── */}
            {result && !loading && (
              <div className="card detection-card animate-fadeInUp">
                <div className="detection-header">
                  <h3>🔬 {t('ai.detectionDetails')}</h3>
                  <span className="scan-time"><HiOutlineClock /> Vừa quét xong</span>
                </div>
                <div className="detection-body">
                  {preview && <img src={preview} alt="Scanned" className="scanned-image" />}
                  <div className="detection-info">
                    <div className="confidence-ring">
                      <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="42" fill="none"
                          stroke={getConfidenceColor(result.confidence)}
                          strokeWidth="6"
                          strokeDasharray={`${result.confidence * 2.64} 264`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                          className="confidence-circle-animated"
                        />
                        <text x="50" y="45" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-primary)">
                          {Math.round(result.confidence)}%
                        </text>
                        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)">
                          {t('ai.match')}
                        </text>
                      </svg>
                    </div>
                    <div className="detection-text">
                      <h2>{result.disease_name}</h2>
                      <p className="treatment-preview">{result.treatment}</p>
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

          {/* ── Right Panel: Treatment ── */}
          <div className="ai-right">
            <div className="card treatments-card">
              <h3>🌿 {t('ai.recommendedTreatments')}</h3>
              {result && !loading ? (
                <div className="treatment-item animate-fadeInUp">
                  <h4>{result.disease_name}</h4>
                  <span className={`badge ${result.disease_id === 5 ? 'badge-success' : 'badge-danger'}`}>
                    {result.disease_id === 5 ? '✅ CÂY KHỎE MẠNH' : '⚠️ CẦN XỬ LÝ'}
                  </span>
                  <p>{result.treatment}</p>
                  <div className="treatment-footer">
                    <span className="efficacy">
                      Độ tin cậy: {result.confidence}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="empty-text">{t('ai.uploadHint')}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIPage;
