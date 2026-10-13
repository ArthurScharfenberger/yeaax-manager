-- Migration 0002 — id da conta na plataforma (ex.: open_id do TikTok).
-- Documentação: docs/DATABASE.md (DEC-028)
--
-- Identifica a conta mesmo que o @ mude e impede cadastrar a mesma conta duas vezes.
-- Nulo para canais simulados/antigos; preenchido na conexão ou na verificação ao abrir o app.

ALTER TABLE channels ADD COLUMN external_id TEXT;

CREATE UNIQUE INDEX idx_channels_platform_external_id
  ON channels (platform, external_id)
  WHERE external_id IS NOT NULL;
