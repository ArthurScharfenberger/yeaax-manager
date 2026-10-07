//! Comandos expostos ao frontend via `invoke`.
//!
//! Comandos devem ser `async` para não bloquear a thread principal (UI) e devem
//! validar toda entrada vinda do webview.

pub mod media;
pub mod system;
