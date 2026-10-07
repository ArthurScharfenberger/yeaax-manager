# AGENTS.md — instruções para agentes de IA (Claude Code, Codex, Copilot…) e colaboradores

Este projeto será desenvolvido por muitos meses, em sessões curtas e por agentes diferentes.
**A documentação faz parte do produto.** Código sem documentação correspondente em decisões importantes
é considerado incompleto.

## 1. Antes de começar (sempre, nesta ordem)

1. `README.md` — o que é, como rodar.
2. `docs/PROJECT.md` — visão e princípios.
3. `docs/ARCHITECTURE.md` — camadas, pastas e fluxo de dados.
4. `docs/ROADMAP.md` — em que fase estamos.
5. `docs/TODO.md` — o que fazer agora.
6. `docs/DEVELOPMENT_LOG.md` — a última sessão: pendências e próximo passo.
7. `docs/DECISIONS.md` — **obrigatório antes de alterar arquitetura, dependências ou o banco.**

Se a tarefa tocar em integrações, leia também `docs/INTEGRATIONS.md`, `docs/API_NOTES.md` e `docs/SECURITY.md`.
Se tocar na interface, leia `docs/DESIGN.md`. Se tocar no banco, leia `docs/DATABASE.md`.

## 2. Regras de código

- **TypeScript strict** sempre. Proibido `any`, `@ts-ignore` e `eslint-disable` sem justificativa no comentário.
- **SQL só em `src/db/`.** Componentes e features usam serviços → repositórios. Placeholders sempre `?`.
- **Integrações externas só em `src/services/`**, atrás de interfaces (`SocialProvider`, `AIProvider`,
  `VideoProcessor`, `DesktopBridge`). Features nunca importam `@tauri-apps/*` diretamente.
- **Regras de negócio em TypeScript** (`features/*/…Rules.ts` puras + `…Service.ts`). Rust só para sistema
  (arquivos, processos, banco, credenciais). Ver DEC-003.
- **Sem strings mágicas:** status/plataformas vêm de `src/types`, rótulos de `src/lib/labels.ts`,
  rotas de `src/app/routes.ts`, chaves de query de `src/lib/queryKeys.ts`.
- **Erros:** lance `AppError` com código; mostre `getErrorMessage(error)` ao usuário; registre com `logger`.
  Nunca `console.log` (regra de lint).
- **Arquivos pequenos e focados.** Componente passou de ~250 linhas? Divida.
- **Não introduza dependência sem necessidade.** Se for necessária, avalie manutenção e registre em `DECISIONS.md`.
- **Nunca remova funcionalidade sem motivo** explícito, registrado no CHANGELOG.
- **Migrations são imutáveis** depois de distribuídas: crie `src-tauri/migrations/000N_*.sql` nova e registre
  em `src-tauri/src/migrations.rs` (ver `docs/DATABASE.md`).

## 3. Regras de interface

- Visual consistente com `docs/DESIGN.md`: branco + cinzas, azul para ação, verde/amarelo/vermelho só para status.
- **Não use gradientes**, glassmorphism, sombras exageradas, excesso de bordas arredondadas ou cores decorativas.
- Reutilize `src/components/ui/*` antes de criar algo novo. Nada de bibliotecas de componentes prontas.
- Acessibilidade: labels em todos os campos, `aria-*` quando necessário, foco visível, navegação por teclado.
- Não carregue vídeos inteiros: use miniaturas; `<video preload="metadata">` só no preview.

## 4. Regras de segurança (resumo de `docs/SECURITY.md`)

- **Nunca** coloque segredos, tokens ou credenciais no código, no banco, em `VITE_*` ou em logs.
- **Nunca** use scraping, automação de navegador, endpoints não oficiais ou burla de autenticação.
- Dados vindos de APIs (e do lado Rust) são não confiáveis: valide com Zod.
- Nova permissão Tauri (`capabilities/`) ou ampliação de CSP/asset scope exige justificativa no SECURITY.md.

## 5. Definition of Done

Uma tarefa só está concluída quando:

- [ ] código implementado e aplicação executando;
- [ ] `npm run check` passa (typecheck + lint + format + testes) e `cargo test` se mexeu no Rust;
- [ ] comportamento básico validado (no preview `npm run dev` e/ou no app `npm run app:dev`);
- [ ] regras importantes cobertas por teste (não teste detalhes puramente visuais);
- [ ] documentação relacionada atualizada;
- [ ] `docs/TODO.md` atualizado e itens concluídos marcados em `docs/ROADMAP.md`;
- [ ] `docs/CHANGELOG.md` atualizado se a mudança for relevante;
- [ ] decisão arquitetural nova registrada em `docs/DECISIONS.md`;
- [ ] entrada nova em `docs/DEVELOPMENT_LOG.md` ao fim de toda sessão significativa.

## 6. Ao terminar uma sessão

Adicione em `docs/DEVELOPMENT_LOG.md` (formato definido no topo do arquivo): objetivo, alterações,
arquivos importantes, decisões, problemas, pendências e **próximo passo recomendado**. O próximo agente
começa por ali.

## 7. Versionamento

Semantic Versioning. A versão fica em `package.json` (fonte da verdade, lida pelo `tauri.conf.json` e pela UI)
e deve ser espelhada em `src-tauri/Cargo.toml`. Ao lançar versão: atualize ambos + `docs/CHANGELOG.md`.

## 8. Comandos úteis

```bash
npm run app:dev        # app desktop com hot reload
npm run dev            # preview da UI no navegador (dados em memória)
npm run check          # typecheck + lint + format:check + test
npm run lint:fix && npm run format
cargo test --manifest-path src-tauri/Cargo.toml
```
