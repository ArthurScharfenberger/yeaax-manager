# Yeaax Manager — Visão do projeto

> Nome exibido: **Yeaax Manager** (DEC-025; antes "Social Manager"). Versão atual: **0.1.0** (fundação).
> Site: [yeaax.xyz](https://yeaax.xyz) · backend mínimo: `https://api.yeaax.xyz` (DEC-023).

## O que é

Uma central pessoal para gerenciar vários canais/perfis de conteúdo no **TikTok** e no **Instagram**.
Roda como aplicativo desktop no computador do usuário (Windows, inicialmente), com todos os dados
armazenados localmente. Funciona enquanto o computador está ligado. Um **backend mínimo e sem estado**
(`api.yeaax.xyz`) existe só para o que exige servidor público: callback OAuth HTTPS e uso do client secret das
plataformas (DEC-023). Agendar com o computador desligado continua sendo longo prazo.

O objetivo de longo prazo é um **Content Automation Engine**: o usuário adiciona conteúdo à biblioteca e o
sistema ajuda a organizar, preparar (processamento local de vídeo), agendar, publicar e analisar.

## Para quem

Uso pessoal: um criador que mantém marcas/canais como **YEAXX Cars** (@yeaxx), **TechFix** (@techfix.rs) e
**Clipes**, cada um com presença no TikTok e no Instagram, e quer parar de gerenciar planilhas, pastas
soltas e lembretes manuais.

## Capacidades planejadas

| Grupo        | Capacidades                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Canais       | múltiplos perfis TikTok e Instagram, status da conexão, sincronização de perfil                   |
| Biblioteca   | armazenar/referenciar vídeos locais, importar, tags, classificação automática, evitar duplicidade |
| Preparação   | FFmpeg: metadados, miniaturas, adaptação de formato (9:16), compressão, logo/watermark próprios   |
| Posts        | criar, escrever legenda, hashtags, revisão, agendamento, publicação, status, histórico            |
| Planejamento | calendário, filas por canal, Auto Schedule com regras de horário e intervalo                      |
| IA           | legendas e hashtags (OpenAI), traduções, sugestão de melhor conteúdo e horário                    |
| Análise      | desempenho por conteúdo/canal a partir das APIs oficiais                                          |

O que já existe está em [ROADMAP.md](ROADMAP.md) (itens marcados) e no [README](../README.md).

## Princípios

1. **Simplicidade** — a solução mais simples que resolve bem.
2. **Código legível** — nomes claros, arquivos pequenos, comentários explicam o _porquê_.
3. **Arquitetura modular** — features por domínio, integrações isoladas.
4. **Baixo acoplamento** — dependências por interfaces (`SocialProvider`, `AIProvider`, `DesktopBridge`…).
5. **TypeScript estrito** — sem `any`.
6. **Nada de overengineering** — sem microserviços, Docker ou camadas especulativas. Servidor só o backend
   mínimo (DEC-023): sem banco, sem contas de usuário, sem guardar tokens.
7. **Interface profissional** — sóbria, densa, funcional (ver [DESIGN.md](DESIGN.md)).
8. **Local-first** — dados e tokens no computador do usuário; tudo que não envolve as plataformas funciona sem
   Internet. O backend nunca recebe vídeos nem guarda dados.
9. **Documentação continuamente atualizada** — parte da Definition of Done.
10. **Preparação para crescimento** — contratos e pontos de extensão claros, sem implementar antes da hora.
11. **Separação domínio / interface / integrações**.
12. **Integrações externas nunca contaminam a lógica central**.

## Escopo atual (v0.1.0)

- Fundação técnica completa (Tauri 2, React, TypeScript strict, SQLite, lint, testes, documentação).
- Fluxos locais reais: biblioteca, posts, calendário, configurações.
- Integrações **simuladas** (mocks) com contratos prontos para a implementação real; OpenAI real (DEC-022).
- Em andamento (fase atual): **TikTok real** — Login Kit Web, Content Posting API e fluxo demonstrável para o
  App Review (DEC-024). Instagram depois.

## Fora de escopo (por enquanto)

- Docker, Kubernetes, infraestrutura empresarial, microserviços; transformar o app em SaaS (contas, banco remoto).
- Funcionamento com o computador desligado (exigiria um serviço remoto — longo prazo).
- **Scraping, automação de navegador, endpoints não oficiais ou qualquer burla de autenticação** — nunca.
- Download de conteúdo de terceiros. Importação por URL só "quando tecnicamente e legalmente permitido" (roadmap).

## Glossário

| Termo                   | Significado                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Canal (Channel)         | Uma conta em uma plataforma (ex.: @yeaxx no TikTok). A mesma marca tem um canal por plataforma. |
| Mídia (Media)           | Um arquivo da biblioteca. O arquivo fica onde está; o app guarda o caminho.                     |
| Tag (MediaTag)          | Etiqueta livre para classificar mídia (`carros`, `tutorial`, `reaproveitar`).                   |
| Post                    | Uma publicação planejada/realizada de uma mídia em um canal.                                    |
| Histórico (PostHistory) | Registro de eventos de um post (criação, agendamento, falha…).                                  |
| Provider                | Implementação de uma integração externa atrás de uma interface.                                 |
| Backend mínimo          | Serviço em `backend/` publicado em `api.yeaax.xyz`: OAuth e client secrets, sem estado.         |
| Modo preview            | A UI rodando no navegador (`npm run dev`) com SQLite WASM em memória.                           |
| Dados de demonstração   | Registros fictícios (`demo-*`) criados na primeira execução.                                    |
