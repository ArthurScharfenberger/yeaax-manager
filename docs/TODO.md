# TODO

Lista operacional. Itens concluídos saem daqui (o histórico fica no CHANGELOG e no DEVELOPMENT_LOG).

Repositório remoto configurado: [yeaax-manager](https://github.com/ArthurScharfenberger/yeaax-manager), branch `main`.

## Agora

- [ ] Usuário: criar a chave em platform.openai.com, colar em Configurações → IA, "Testar conexão" e usar
      "Postar com IA" num vídeo real (validar qualidade das legendas e leitura da miniatura).
- [ ] Instagram real (Fase 3): app na Meta, token do painel no cofre, publicação de Reels por upload resumável.
- [ ] Validar no app desktop: página Posts, duplicar e o arquivo de log sendo criado (reiniciar o `app:dev`,
      pois o Rust mudou).
- [ ] Confirmar no desktop a miniatura automática ao importar um vídeo novo e que as miniaturas continuam
      visíveis após reabrir o app (a captura em si já foi validada com o `white.mp4`).
- [ ] Importar `.mov` e `.webm` reais (`.mp4`, preview e persistência já validados).
- [ ] **Decisões do usuário (pesquisa de APIs):** (1) as contas do Instagram são profissionais (Business/Creator)?
      (2) solicitar auditoria do app no TikTok (necessária para posts públicos) ou usar o modo rascunho?
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
- [ ] Credential Manager (crate `keyring`) antes de qualquer OAuth.
- [ ] Tema escuro (tokens já centralizados em `src/styles/index.css`).
- [ ] Atalhos de teclado (Ctrl+N novo post, Ctrl+K busca).
