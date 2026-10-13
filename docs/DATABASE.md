# Banco de dados

SQLite local. Arquivo do app desktop: `%APPDATA%\com.socialmanager.desktop\social-manager.db`
(diretório de configuração do app, resolvido pelo `tauri-plugin-sql`). **Nunca versione esse arquivo** —
ele contém dados pessoais reais (o `.gitignore` bloqueia `*.db`).

## Convenções

| Convenção    | Regra                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Ids          | `TEXT` — UUID v4 gerado na aplicação (`createId()`); dados de demonstração usam `demo-*`     |
| Datas        | `TEXT` em ISO 8601 UTC (`toISOString()`), comparáveis lexicograficamente                     |
| Enums        | `TEXT` validado com Zod na aplicação, **sem `CHECK`** (DEC-007)                              |
| Booleanos    | evitar; quando necessário, `INTEGER` 0/1                                                     |
| JSON         | `TEXT` (ex.: `app_settings.value`) validado por schema ao ler                                |
| Nomes        | tabelas no plural, `snake_case`; o TypeScript usa `camelCase` (mapeamento nos repositórios)  |
| SQL          | **somente em `src/db/`**, placeholders `?` (compatíveis com sqlx, sqlite-wasm e node:sqlite) |
| Transações   | não usar entre chamadas (pool de conexões — DEC-008)                                         |
| Foreign keys | ativas (padrão do sqlx; `PRAGMA foreign_keys = ON` no preview; opção nativa no node:sqlite)  |

## Diagrama

```
channels 1 ──── * posts * ──── 0..1 media * ──── * tags
                   │                    (via media_tags)
                   └── 1 ──── * post_history

app_settings (chave/valor, independente)
```

## Tabelas

### `channels` — contas conectadas

| Coluna                  | Tipo    | Notas                                                                                               |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| id                      | TEXT PK |                                                                                                     |
| platform                | TEXT    | `tiktok` \| `instagram`                                                                             |
| username                | TEXT    | sem `@`; único por plataforma (`UNIQUE(platform, username)`)                                        |
| external_id             | TEXT?   | id da conta na plataforma (open_id do TikTok) — migration 2; único por plataforma quando preenchido |
| display_name            | TEXT    |                                                                                                     |
| avatar_url              | TEXT?   | URL externa (não confiável — exibir só como imagem; só CDNs do TikTok liberados na CSP)             |
| status                  | TEXT    | `connected` \| `disconnected` \| `expired` \| `error`                                               |
| last_synced_at          | TEXT?   | última sincronização com a plataforma                                                               |
| created_at / updated_at | TEXT    |                                                                                                     |

> Tokens **não** ficam nesta tabela (nem em lugar nenhum do banco) — ver SECURITY.md.

### `media` — biblioteca

| Coluna                  | Tipo        | Notas                                                                       |
| ----------------------- | ----------- | --------------------------------------------------------------------------- |
| id                      | TEXT PK     |                                                                             |
| filename                | TEXT        | nome exibido                                                                |
| original_filename       | TEXT        | nome no momento da importação                                               |
| file_path               | TEXT UNIQUE | caminho absoluto do original (DEC-006); demo usa `demo://…`                 |
| type                    | TEXT        | `video` \| `image` (só vídeo é importável hoje)                             |
| mime_type               | TEXT        | `video/mp4`, `video/quicktime`, `video/webm`                                |
| size                    | INTEGER     | bytes                                                                       |
| duration                | REAL?       | segundos (null se ilegível)                                                 |
| width / height          | INTEGER?    | pixels                                                                      |
| thumbnail_path          | TEXT?       | JPEG em `%APPDATA%\com.socialmanager.desktop\thumbnails\<id>.jpg` (DEC-018) |
| status                  | TEXT        | `imported` \| `processing` \| `ready` \| `used` \| `error`                  |
| created_at / updated_at | TEXT        |                                                                             |

Índices: `idx_media_status`, `idx_media_created_at`.

### `tags` e `media_tags` — classificação (entidade "MediaTag")

`tags(id, name UNIQUE COLLATE NOCASE, created_at)` — nomes normalizados em minúsculas.
`media_tags(media_id → media ON DELETE CASCADE, tag_id → tags ON DELETE CASCADE, created_at)`, PK composta.
Índice: `idx_media_tags_tag_id`.

### `posts` — publicações

| Coluna                  | Tipo            | Notas                                                                                        |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| id                      | TEXT PK         |                                                                                              |
| channel_id              | TEXT → channels | `ON DELETE RESTRICT` (canal com posts não pode ser removido)                                 |
| media_id                | TEXT? → media   | `ON DELETE SET NULL` (remover da biblioteca não apaga o post)                                |
| caption                 | TEXT            | padrão `''`                                                                                  |
| status                  | TEXT            | `draft` \| `review` \| `scheduled` \| `publishing` \| `published` \| `failed` \| `cancelled` |
| scheduled_at            | TEXT?           | obrigatório para `scheduled` (regra na aplicação)                                            |
| published_at            | TEXT?           |                                                                                              |
| external_post_id        | TEXT?           | id na plataforma                                                                             |
| created_at / updated_at | TEXT            |                                                                                              |

Índices: `channel_id`, `media_id`, `status`, `scheduled_at`.
Regra anti-duplicidade (aplicação): o mesmo `media_id` não pode estar `scheduled/publishing/published` duas
vezes no mesmo canal.

### `post_history` — auditoria

`(id, post_id → posts ON DELETE CASCADE, event, from_status?, to_status?, message?, created_at)`.
Eventos: `created`, `updated`, `status_changed`, `scheduled`, `rescheduled`, `publish_attempt`, `published`,
`failed`, `cancelled`. Índice: `(post_id, created_at)`.

### `app_settings` — configurações locais

`(key PK, value TEXT JSON, updated_at)`. Chaves atuais:

| Chave                     | Schema                 | Onde é definida                        |
| ------------------------- | ---------------------- | -------------------------------------- |
| `general.weekStartsOn`    | `'monday' \| 'sunday'` | `features/settings/settingsService.ts` |
| `automation.autoSchedule` | `AutoScheduleConfig`   | `features/automation/autoSchedule.ts`  |
| `demo.seededAt`           | ISO string             | `db/demoData.ts` (impede re-seed)      |

Valores inválidos voltam ao padrão com aviso no log. **Nunca guarde segredos aqui.**

## Migrations

- Arquivos: `src-tauri/migrations/NNNN_descricao.sql` — **fonte única** para o app (Rust, via `include_str!`),
  o preview (SQLite WASM) e os testes (`node:sqlite`).
- Registro: `src-tauri/src/migrations.rs` (versão, descrição, SQL). O plugin guarda o controle em `_sqlx_migrations`.
- **Nunca edite uma migration já distribuída.** Crie a próxima versão.
- Mudança de enum: não exige migration (DEC-007), só atualizar o schema Zod em `src/types`.
- Recriar tabela referenciada por FK com cascade (ex.: `posts`) apaga dados dependentes — evite; prefira `ALTER TABLE ADD COLUMN`.

| Versão | Arquivo                        | Conteúdo                                                                          |
| ------ | ------------------------------ | --------------------------------------------------------------------------------- |
| 1      | `0001_initial_schema.sql`      | channels, media, tags, media_tags, posts, post_history, app_settings              |
| 2      | `0002_channel_external_id.sql` | `channels.external_id` + índice único parcial `(platform, external_id)` (DEC-028) |

## Tabelas futuras (não criar antes da necessidade)

| Tabela                  | Fase | Propósito                                                         |
| ----------------------- | ---- | ----------------------------------------------------------------- |
| `media_processing_jobs` | 2    | jobs do FFmpeg (tipo, status, progresso, saída, erro)             |
| `automation_rules`      | 2    | regras além do Auto Schedule (por canal, categoria)               |
| `publication_attempts`  | 3    | cada tentativa de publicação (request id, resposta, erro)         |
| `analytics_snapshots`   | 3    | métricas por post/canal ao longo do tempo                         |
| `ai_executions`         | 3    | prompts/resultados/custos de chamadas de IA (sem dados sensíveis) |
| `content_categories`    | 2+   | categorias de conteúdo para recomendações                         |
