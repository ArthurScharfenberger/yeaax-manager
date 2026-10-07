# src/stores

Reservado para estado global de cliente (Zustand), **somente se houver necessidade real**.

Hoje não há stores: estado assíncrono/persistido usa TanStack Query (`src/features/*/hooks.ts`) e
estado de UI compartilhado usa contextos pequenos (`ToastProvider`, `PostDialogsProvider`).
Ver DEC-005 em `docs/DECISIONS.md` antes de adicionar uma store.
