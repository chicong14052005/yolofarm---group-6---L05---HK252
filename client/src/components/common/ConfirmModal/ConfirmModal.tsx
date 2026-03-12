import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal = ({ isOpen, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel, variant = 'danger' }: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className={`confirm-icon ${variant}`}>
          {variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚡' : 'ℹ️'}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className={`btn btn-${variant === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmText}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
