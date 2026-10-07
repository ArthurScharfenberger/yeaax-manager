# Notas sobre APIs externas

Espaço reservado para anotações técnicas das APIs (limites, escopos, formatos, erros, mudanças de versão).
**Toda informação aqui deve ser confirmada na documentação oficial antes de ser usada no código** — APIs
de redes sociais mudam com frequência. Registre a data e a fonte de cada anotação.

Formato sugerido:

```
### <API> — <assunto>
- Data da verificação: AAAA-MM-DD
- Fonte: <link da documentação oficial>
- Nota: ...
- Impacto no projeto: ...
```

## Pendências de verificação (a confirmar antes da Fase 3)

Itens levantados no planejamento, **ainda não verificados** na documentação oficial:

### Limites de legenda e hashtags (usados hoje em `src/lib/platforms.ts`)

- Valores provisórios: legenda até 2200 caracteres em ambas; até 30 hashtags no Instagram.
- O app conta unidades UTF-16 (`string.length`), o que é conservador para emojis.
- Confirmar como cada plataforma conta caracteres e se há limites de menções/hashtags no TikTok.

### TikTok — Content Posting API

- Confirmar: escopos necessários (publicação direta vs. envio como rascunho para o app), exigência de
  auditoria do app para posts públicos, limites de envio por dia, formatos/duração/tamanho aceitos,
  envio por upload de arquivo (chunks) vs. URL.
- Impacto: define se o fluxo "publicar" envia o arquivo local diretamente (ideal para local-first).

### Instagram — Graph API (Reels)

- Confirmar: tipo de conta exigido (profissional), fluxo container → publish, se o vídeo pode ser enviado
  por upload direto/resumável ou exige URL pública, limite de publicações via API por 24h, requisitos de
  formato (proporção, duração, codec).
- Impacto: se exigir URL pública, será preciso um armazenamento temporário — decisão de arquitetura (nova DEC).

### OpenAI

- Confirmar: modelo, limites de tokens/custo, política de dados; definir teto de gasto por mês.

## Notas verificadas

_Nenhuma ainda._
