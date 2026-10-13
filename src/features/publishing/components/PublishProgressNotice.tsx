import { Notice } from '@/components/ui/Notice';
import type { PublishProgress } from '@/services/social';

function describe(progress: PublishProgress): string {
  switch (progress.stage) {
    case 'preparing':
      return 'Conferindo a conta no TikTok e iniciando o envio…';
    case 'uploading': {
      const percent = progress.total > 0 ? Math.floor((progress.sent / progress.total) * 100) : 0;
      return `Enviando o vídeo ao TikTok… ${percent}%`;
    }
    case 'processing':
      return 'Vídeo enviado. O TikTok está processando…';
  }
}

/** Andamento do "Publicar agora" (não feche o app durante o envio). */
export function PublishProgressNotice({ progress }: { progress: PublishProgress }) {
  const percent =
    progress.stage === 'uploading' && progress.total > 0
      ? Math.floor((progress.sent / progress.total) * 100)
      : progress.stage === 'processing'
        ? 100
        : 0;
  return (
    <div role="status" aria-live="polite">
      <Notice title="Publicando">
        <p>{describe(progress)}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1.5 text-ink-3">Mantenha o app aberto até terminar.</p>
      </Notice>
    </div>
  );
}
