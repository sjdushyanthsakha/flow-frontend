import { useEffect, useRef, useId, type ReactNode } from 'react';
import { Icon } from '../../lib/icons';

export function OperationsHeading({ section, title, description, children }: {
  section: string; title: string; description: string; children?: ReactNode;
}) {
  return <header className="operations-heading">
    <div><span className="eyebrow">{section}</span><h1>{title}</h1><p>{description}</p></div>
    {children && <div className="operations-actions">{children}</div>}
  </header>;
}

export function OperationsDialog({ title, eyebrow, description, variant, onClose, busy, children }: {
  title: string; eyebrow?: string; description?: string; variant?: 'drawer' | 'wide'; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (variant && opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [variant]);
  return <dialog ref={ref} className={variant ? `operations-dialog operations-dialog--${variant}` : 'operations-dialog'} aria-labelledby={heading}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="operations-dialog-content">
      <header><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id={heading}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="close" /></button></header>
      {children}
    </div>
  </dialog>;
}
