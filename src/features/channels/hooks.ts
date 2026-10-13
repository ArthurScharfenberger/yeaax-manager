import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useServices } from '@/app/ServicesContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import { queryKeys } from '@/lib/queryKeys';
import type { Id, Platform } from '@/types';

import type { NewChannelInput } from './channelService';

const AFFECTED = ['channels', 'posts', 'dashboard', 'search'] as const;

export function useChannels() {
  const { channels } = useServices();
  return useQuery({ queryKey: queryKeys.channels.all, queryFn: () => channels.list() });
}

/** A plataforma conecta pelo login oficial (navegador) em vez de pedir o @? */
export function useHasOfficialLogin(platform: Platform): boolean {
  return useServices().social[platform].capabilities.officialLogin;
}

/** Providers simulados: cadastra a conta pelo @ informado. */
export function useConnectNewChannel() {
  const { channels } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: NewChannelInput) => channels.connectNew(input),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

/** Login oficial: abre a autorização no navegador; cria ou reconecta o canal da conta autorizada. */
export function useConnectAccount() {
  const { channels } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (platform: Platform) => channels.connectAccount(platform),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

/** Cancela o login oficial em andamento (a mutation pendente termina com `TIKTOK_LOGIN_CANCELLED`). */
export function useCancelConnect() {
  const { channels } = useServices();
  return (platform: Platform) => channels.cancelConnect(platform);
}

/** Conectar, desconectar, sincronizar ou remover um canal existente. */
export function useChannelAction() {
  const { channels } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: Id;
      action: 'connect' | 'disconnect' | 'sync' | 'remove';
    }) => channels[action](id),
    // Inclusive em erro: uma sincronização pode ter marcado o canal como "Sessão expirada".
    onSettled: () => invalidate(...AFFECTED),
  });
}

/** Garante uma única verificação por sessão (o StrictMode monta os efeitos duas vezes em dev). */
let verified = false;

/**
 * Ao abrir o app, confere as contas conectadas por login oficial: renova tokens, atualiza perfil e marca as que
 * perderam a credencial como "Sessão expirada". Sem internet, nada muda. Ver `channelService.verifyConnections`.
 */
export function useConnectionCheck(): void {
  const { channels, mode } = useServices();
  const invalidate = useInvalidate();

  useEffect(() => {
    if (mode !== 'desktop' || verified) return;
    verified = true;
    void channels.verifyConnections().then(({ checked }) => {
      if (checked > 0) void invalidate(...AFFECTED);
    });
  }, [channels, mode, invalidate]);
}
