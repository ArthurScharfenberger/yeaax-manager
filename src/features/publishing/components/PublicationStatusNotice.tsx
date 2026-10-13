import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/toastContext';
import type { PostWithRelations } from '@/types';

import { useRefreshPublication } from '../hooks';
import { PROCESSING_NOTICE } from '../publishService';

/**
 * Post em processamento na plataforma: aviso exigido pelas diretrizes do TikTok ("pode levar alguns minutos") e
 * consulta manual do status (o agendador também consulta sozinho a cada 30 s).
 */
export function PublicationStatusNotice({ post }: { post: PostWithRelations }) {
  const refresh = useRefreshPublication();
  const toast = useToast();
  if (post.status !== 'publishing') return null;
  return (
    <Notice title="Processando no TikTok">
      <p>{PROCESSING_NOTICE}</p>
      <Button
        size="sm"
        icon={RefreshCw}
        className="mt-2"
        loading={refresh.isPending}
        onClick={() =>
          refresh.mutate(post.id, {
            onSuccess: (status) => {
              if (status === 'published') toast.success('Post publicado no TikTok');
              else if (status === 'failed')
                toast.info('O TikTok não publicou o vídeo', 'O motivo está no histórico do post.');
              else toast.info('Ainda processando', 'Tente de novo em alguns instantes.');
            },
            onError: (error) => toast.error(error),
          })
        }
      >
        Atualizar status
      </Button>
    </Notice>
  );
}
