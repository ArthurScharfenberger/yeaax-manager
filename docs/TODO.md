# TODO

Lista operacional. Itens concluídos saem daqui (o histórico fica no CHANGELOG e no DEVELOPMENT_LOG).

## Agora

- [ ] Rodar `npm run app:dev` e validar manualmente no Windows: importar `.mp4/.mov/.webm` reais, conferir
      duração/resolução lidas pelo WebView2, preview no painel de detalhes, reabrir o app e conferir persistência.
- [ ] Confirmar os limites de legenda/hashtags em `src/lib/platforms.ts` contra a documentação oficial
      (ver `docs/API_NOTES.md`).
- [ ] Decidir o local da pasta de arquivos gerados pelo app (miniaturas/versões processadas) — provável `%APPDATA%\com.socialmanager.desktop\media\`.

## Próximo

- [ ] `tauri-plugin-log`: persistir logs em arquivo com rotação, mantendo a redação de dados sensíveis.
- [ ] Backup/restauração do banco (exportar e importar o arquivo `.db`).
- [ ] FFmpeg: comando Rust `probe_media` (ffprobe) e `generate_thumbnail`; preencher `thumbnail_path`.
- [ ] Comandos Rust transacionais para operações compostas críticas (ver DEC-008).
- [ ] Página/visão "Todos os posts" com filtros (status, canal, sem data).
- [ ] Ação "Duplicar para outro canal" no menu do post.
- [ ] Testes de componentes para fluxos críticos (compositor de post) com Testing Library — avaliar custo/benefício.

## Depois

- [ ] Motor do Auto Schedule (Fase 2) usando `planDailySlots` e as regras salvas.
- [ ] Ícone na bandeja do sistema e agendador local.
- [ ] Hash de arquivo para detectar vídeos duplicados com nomes diferentes.
- [ ] Credential Manager (crate `keyring`) antes de qualquer OAuth.
- [ ] Tema escuro (tokens já centralizados em `src/styles/index.css`).
- [ ] Atalhos de teclado (Ctrl+N novo post, Ctrl+K busca).
