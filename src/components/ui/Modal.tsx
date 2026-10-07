import { X } from 'lucide-react';
import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';

import { cn } from '@/utils/cn';

import { IconButton } from './IconButton';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
} as const;

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  size?: keyof typeof SIZE_CLASSES;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Diálogo modal baseado em `<dialog>` nativo (foco preso, Esc e camada superior grátis).
 * Fica aberto enquanto estiver montado — o componente pai controla a montagem, o que
 * também reinicia o estado interno a cada abertura.
 */
export function Modal({ title, description, onClose, size = 'md', footer, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  // Cliques no backdrop chegam com o próprio <dialog> como alvo. Exigir que o clique
  // também tenha começado no backdrop evita fechar ao arrastar uma seleção de texto.
  function handleMouseDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
    pressedOnBackdrop.current = false;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={handleMouseDown}
      onClick={handleBackdropClick}
      className={cn(
        'm-auto max-h-[calc(100vh-4rem)] w-[calc(100%-2rem)] animate-fade-in overflow-hidden rounded-md border border-line bg-canvas p-0 text-ink shadow-overlay',
        SIZE_CLASSES[size],
      )}
    >
      <div className="flex max-h-[calc(100vh-4rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-xs text-ink-3">
                {description}
              </p>
            )}
          </div>
          <IconButton icon={X} label="Fechar" size="sm" onClick={onClose} className="-mr-1" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-sunken px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
