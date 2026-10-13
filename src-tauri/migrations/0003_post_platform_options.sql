-- Migration 0003 — opções específicas da plataforma por post (JSON validado com Zod na aplicação).
-- Documentação: docs/DATABASE.md (DEC-029)
--
-- TikTok: privacidade escolhida pelo usuário, permissões de comentário/dueto/stitch, divulgação de conteúdo
-- comercial e o momento do consentimento — exigências das diretrizes de publicação do TikTok (DEC-019).

ALTER TABLE posts ADD COLUMN platform_options TEXT;
