'use client'

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  tone = 'default',
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="confirm-modal-backdrop" role="presentation" onClick={() => { if (!pending) onCancel() }}>
      <div className="confirm-modal confirm-modal-compact" data-tone={tone} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true" className="confirm-modal-mark">{tone === 'danger' ? '⌫' : '✓'}</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        {message ? <p className="confirm-modal-message">{message}</p> : null}
        <div className="confirm-modal-actions">
          <button type="button" className="button button-secondary" disabled={pending} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={tone === 'danger' ? 'button confirm-modal-danger' : 'button'} disabled={pending} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
