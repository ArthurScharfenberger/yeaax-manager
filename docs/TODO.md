# TODO

Lista operacional. Itens concluídos saem daqui (o histórico fica no CHANGELOG e no DEVELOPMENT_LOG).

Repositório remoto configurado: [yeaax-manager](https://github.com/ArthurScharfenberger/yeaax-manager), branch `main`.

## Agora

Fase atual: **TikTok real** (ordem em `docs/INTEGRATIONS.md` → TikTok).

- [ ] Usuário — publicar o backend: push do repositório e projeto Vercel com Root Directory `backend`
      (passo a passo em `backend/README.md`); conferir `https://api.yeaax.xyz/health` → `configured: true`.
- [ ] Após o deploy: confirmar que o rewrite entrega o caminho original ao handler (`/health` e `/config`
      respondendo) e que os imports `.js` → `.ts` foram empacotados (não testável sem a Vercel).
- [ ] Usuário — TikTok Developer Portal: Login Kit na plataforma **Desktop** com redirect URI
      `http://127.0.0.1:*/tiktok/callback`; Content Posting API com Direct Post; escopos `user.info.basic`,
      `user.info.profile`, `video.publish`, `video.upload`; termos/privacidade em `yeaax.xyz`; sandbox com a própria
      conta como target user (conta **privada** para os testes).
- [ ] Usuário — Vercel/DNS: projeto separado com Root Directory `backend`, domínio `api.yeaax.xyz` (CNAME) e
      variáveis secretas `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` (opcional `TIKTOK_SCOPES`).
- [ ] Validar a etapa 4 no app (usuário): avatar real aparece; "Adicionar canal → TikTok" conecta sem pedir @ e
      reconecta o mesmo canal se a conta já existir; "Cancelar login" fecha a espera; reabrir o app mantém conectado.
- [ ] Etapas 5–7 — compositor TikTok (UX obrigatória), publicação real, status/demonstração para o App Review.
- [ ] Usuário: criar a chave em platform.openai.com, colar em Configurações → IA, "Testar conexão" e usar
      "Postar com IA" num vídeo real (validar qualidade das legendas e leitura da miniatura).
- [ ] Instagram real — **depois do TikTok**: app na Meta, token do painel no cofre, Reels por upload resumável.
- [ ] Validar no app desktop: página Posts, duplicar e o arquivo de log sendo criado (reiniciar o `app:dev`,
      pois o Rust mudou).
- [ ] Confirmar no desktop a miniatura automática ao importar um vídeo novo e que as miniaturas continuam
      visíveis após reabrir o app (a captura em si já foi validada com o `white.mp4`).
- [ ] Importar `.mov` e `.webm` reais (`.mp4`, preview e persistência já validados).
- [ ] Decidir a pasta das versões processadas pelo FFmpeg (miniaturas já ficam em `%APPDATA%\com.socialmanager.desktop\thumbnails\`).

## Próximo

- [ ] Backup/restauração do banco (exportar e importar o arquivo `.db`).
- [ ] FFmpeg: comando Rust `probe_media` (ffprobe) e `generate_thumbnail`; preencher `thumbnail_path`.
- [ ] Comandos Rust transacionais para operações compostas críticas (ver DEC-008).
- [ ] Testes de componentes para fluxos críticos (compositor de post) com Testing Library — avaliar custo/benefício.

## Depois

- [ ] Motor do Auto Schedule (Fase 2) usando `planDailySlots` e as regras salvas.
- [ ] Ícone na bandeja do sistema e agendador local.
- [ ] Hash de arquivo para detectar vídeos duplicados com nomes diferentes.
- [ ] Tema escuro (tokens já centralizados em `src/styles/index.css`).
- [ ] Atalhos de teclado (Ctrl+N novo post, Ctrl+K busca).
