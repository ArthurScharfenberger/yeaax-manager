//! Integração com o TikTok no lado nativo (Login Kit Desktop + PKCE — DEC-027).
//!
//! - `pkce` / `loopback`: lógica pura (PKCE com desafio hex, `state`, validação do callback local);
//! - `listener`: servidor HTTP de uso único em `127.0.0.1`;
//! - `backend`: troca/renovação/revogação via `api.yeaax.xyz` (o `client_secret` só existe lá);
//! - `tokens`: cofre do Windows por canal; `pending`: conexões aguardando confirmação;
//! - `api`: chamadas diretas ao TikTok com o token do usuário (perfil; publicação na etapa 6);
//! - `creator`: `creator_info` (o que a conta pode publicar agora — exigido pelas diretrizes);
//! - `secret`: envelope que impede valores sensíveis de aparecerem em `Debug`/logs.
//!
//! Os comandos expostos ao webview ficam em `commands/tiktok.rs`.

pub mod api;
pub mod backend;
pub mod creator;
pub mod listener;
pub mod loopback;
pub mod pending;
pub mod pkce;
pub mod secret;
pub mod tokens;
