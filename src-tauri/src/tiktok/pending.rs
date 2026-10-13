//! Conexões pendentes: tokens já obtidos, mas ainda **não** gravados no cofre (DEC-027).
//!
//! `tiktok_connect` guarda aqui o resultado e devolve ao frontend só um id opaco + dados públicos. O frontend
//! grava o canal no banco e então confirma (`commit`, que grava no cofre) ou desiste (`discard`). Assim a conexão
//! é transacional do ponto de vista lógico: ou banco e cofre ficam consistentes, ou nada muda. Itens expiram.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use super::tokens::StoredTokens;

/// Tempo para o frontend confirmar ou descartar uma conexão.
pub const PENDING_TTL: Duration = Duration::from_secs(5 * 60);

pub struct PendingConnection {
    pub tokens: StoredTokens,
    created_at: Instant,
}

impl PendingConnection {
    pub fn new(tokens: StoredTokens, created_at: Instant) -> Self {
        Self { tokens, created_at }
    }
}

#[derive(Default)]
pub struct PendingRegistry {
    entries: HashMap<String, PendingConnection>,
}

impl PendingRegistry {
    fn prune(&mut self, now: Instant) {
        self.entries
            .retain(|_, entry| now.duration_since(entry.created_at) < PENDING_TTL);
    }

    pub fn insert(&mut self, id: String, connection: PendingConnection, now: Instant) {
        self.prune(now);
        self.entries.insert(id, connection);
    }

    /// Remove e devolve a conexão (uso único). Expirada → `None`.
    pub fn take(&mut self, id: &str, now: Instant) -> Option<PendingConnection> {
        self.prune(now);
        self.entries.remove(id)
    }

    pub fn discard(&mut self, id: &str) {
        self.entries.remove(id);
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tiktok::backend::TokenSet;
    use crate::tiktok::secret::Secret;

    fn connection(now: Instant) -> PendingConnection {
        let tokens = StoredTokens::from_token_set(
            TokenSet {
                open_id: "open-1".into(),
                scopes: vec![],
                access_token: Secret::new("act"),
                expires_in: 60,
                refresh_token: Secret::new("rft"),
                refresh_expires_in: 60,
            },
            0,
        );
        PendingConnection::new(tokens, now)
    }

    #[test]
    fn take_e_de_uso_unico() {
        let now = Instant::now();
        let mut registry = PendingRegistry::default();
        registry.insert("a".into(), connection(now), now);
        assert!(registry.take("a", now).is_some());
        assert!(registry.take("a", now).is_none());
    }

    #[test]
    fn expira_e_descarta() {
        let now = Instant::now();
        let mut registry = PendingRegistry::default();
        registry.insert("a".into(), connection(now), now);
        registry.insert("b".into(), connection(now), now);
        registry.discard("b");
        assert_eq!(registry.len(), 1);
        assert!(registry.take("a", now + PENDING_TTL).is_none());
        assert_eq!(registry.len(), 0);
    }
}
