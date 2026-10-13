//! Integração com o TikTok no lado nativo (Login Kit Desktop + PKCE — DEC-027).
//!
//! Etapa 3 em andamento: por enquanto só a lógica pura (PKCE, `state`, validação do callback local), coberta
//! por testes. O listener, a troca pelo backend e o cofre de tokens chegam nos próximos commits.
// Os módulos ainda não são chamados por nenhum comando; a permissão some quando forem ligados (etapa 3).
#![cfg_attr(not(test), allow(dead_code))]

pub mod loopback;
pub mod pkce;
