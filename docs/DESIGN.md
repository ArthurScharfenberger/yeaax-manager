# Diretrizes de interface

Referência: softwares de produtividade profissionais (densos, sóbrios, previsíveis). A interface deve parecer
uma ferramenta de trabalho, não uma landing page de SaaS.

## Princípios

1. **Hierarquia por tipografia e espaçamento**, não por cor ou sombra.
2. **Densidade adequada**: corpo em 13px, linhas de tabela de 48px, controles de 32px.
3. **Superfícies planas** delimitadas por bordas de 1px. Sem cards flutuando.
4. **Cor tem função**: azul = ação/seleção; verde = sucesso; amarelo = alerta; vermelho = erro. Nada além disso.
5. **Honestidade**: tudo que é simulado é rotulado como tal ("Simulado", "em breve"). Nenhum número inventado.

## Proibido

Gradientes · glassmorphism · sombras em superfícies estáticas · bordas muito arredondadas (máx. `rounded-md`, 6px) ·
cores decorativas · ilustrações sem função · ícones coloridos de marca · emojis na interface (exceto em conteúdo do usuário).

## Tokens (`src/styles/index.css`)

| Token                                                   | Uso                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `canvas` (#fff)                                         | fundo principal                                                        |
| `sunken`                                                | sidebar, cabeçalho de tabela, rodapé de modal, áreas de leitura        |
| `hover` / `pressed`                                     | estados de interação e item ativo                                      |
| `line` / `line-strong`                                  | bordas de seções / bordas de controles                                 |
| `ink`, `ink-2`, `ink-3`                                 | texto principal, secundário, auxiliar (todos ≥ 4.5:1)                  |
| `ink-4`                                                 | placeholder e decorativo apenas (contraste baixo)                      |
| `accent` (+ `-hover`, `-subtle`, `-line`, `-ink`)       | ações primárias, links, foco, seleção, "hoje"                          |
| `success` / `warning` / `danger` (+ `-subtle`, `-line`) | exclusivamente status e mensagens                                      |
| `shadow-overlay`                                        | somente camadas flutuantes: modais, menus, toasts, resultados de busca |

Escala de texto: `2xs` 11 · `xs` 12 · `sm` 13 (corpo) · `base` 14 · `lg` 16 (títulos de página) · `xl` 20 · `2xl` 24 (métricas).
Fonte do sistema (Segoe UI Variable no Windows); números tabulares com a utility `tabular`.

## Componentes (`src/components/ui`)

| Componente                             | Quando usar                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Button`                               | `primary` uma vez por área (ação principal); `secondary` padrão; `ghost` ações discretas; `danger` destrutivas |
| `IconButton`                           | ação só com ícone — `label` obrigatório (aria + tooltip)                                                       |
| `Input`, `Textarea`, `Select`          | sem largura padrão: dentro de `Field` esticam; fora, passe `w-*`                                               |
| `Field`                                | rótulo + controle + dica/erro (associa `htmlFor`)                                                              |
| `Checkbox`, `SegmentedControl`         | opções booleanas / exclusivas (radiogroup com setas)                                                           |
| `Badge` + `StatusBadges`               | status com ponto (`dot`); tons fixos por status                                                                |
| `Panel`                                | seção com título e ações; bloco básico do dashboard                                                            |
| `PageHeader`                           | título + descrição + ações de cada página                                                                      |
| `Table`, `THead`, `Th`, `Tr`, `Td`     | listas densas                                                                                                  |
| `Modal`                                | `<dialog>` nativo; montar/desmontar controla abertura                                                          |
| `ConfirmDialog`                        | toda ação destrutiva ou irreversível                                                                           |
| `ActionMenu`                           | menu "⋯" (Popover API) com navegação por teclado                                                               |
| `Toast` (`useToast`)                   | confirmação de ações e falhas fora de formulários                                                              |
| `Notice`                               | aviso persistente inline (modo simulado, erros de formulário)                                                  |
| `EmptyState`, `Spinner`/`LoadingBlock` | estados vazios e de carregamento                                                                               |
| `SettingRow`                           | linhas de configuração (rótulo à esquerda, controle à direita)                                                 |

Peças de domínio: `PlatformMark` (monograma neutro TT/IG — sem logotipos), `MediaThumbnail` (nunca carrega o vídeo).

## Padrões

- **Layout de página:** `PageHeader` → conteúdo rolável com `max-w` e `p-6` → painéis com `gap-5`.
- **Erros:** formulários mostram `Notice tone="danger"` inline; ações avulsas usam `toast.error(error)`.
- **Confirmação:** exclusões, cancelamentos e remoções sempre com `ConfirmDialog` explicando a consequência.
- **Texto:** pt-BR, frases curtas, verbo no infinitivo nos botões ("Agendar", "Importar vídeo").
- **Acessibilidade:** todo controle com rótulo; foco visível (`:focus-visible` com contorno azul); teclado em
  menus, segmented controls e busca (setas/Enter/Esc); `aria-live` em toasts; linhas clicáveis sempre têm um
  botão real equivalente para teclado.
- **Desempenho visual:** miniaturas/placeholders nas listas; `<video>` só no painel de detalhes, com `preload="metadata"`.
