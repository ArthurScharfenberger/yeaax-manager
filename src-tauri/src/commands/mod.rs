//! Comandos expostos ao frontend via `invoke`.
//!
//! Comandos devem ser `async` para não bloquear a thread principal (UI) e devem
//! validar toda entrada vinda do webview.

pub mod ai;
pub mod media;
pub mod secrets;
pub mod system;
pub mod thumbnails;
pub mod tiktok;
