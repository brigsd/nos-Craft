# NÓS-Craft

> O primeiro **Ramo de guerra** do NÓS: pegada de MMO clássico no navegador,
> 100% dentro do GitHub. Hoje o repo é, acima de tudo, **A Forja** — a bancada
> de ferramentas que cria e audita os objetos 3D do mundo.

## O que é isto

NÓS-Craft nasceu como um jogo estilo WoW-clássico plugável no portal do NÓS.
No caminho, o foco **virou a ferramenta**: em vez de terminar o jogo, o
trabalho é construir a bancada mais potente possível para criar objetos 3D
bonitos, realistas e otimizados — usando a qualidade dos objetos como prova de
que a ferramenta melhorou. Ver `docs/DECISIONS.md` (D-2) para o porquê.

O motor do jogo (terreno, combate, quests) continua no repo e funciona, mas
está **congelado** — só volta a andar se o ideador pedir. O que evolui é a
Forja.

## Começar

```bash
npm install            # três.js já está vendorizado; isto instala o playwright-core do QA
npm test               # 5/5 — lógica de combate/quest/dados (node --test)
npm run forja -- audit # crítico algorítmico em todos os objetos (exit 1 se reprovar)
```

Abrir no navegador (via qualquer server estático na raiz):
- **`studio.html`** — A Forja: um objeto por vez, 3 luzes, turntable, régua humana.
- **`cartografo.html`** — mapa de cima do mundo gerado (Canvas2D).
- **`index.html`** — o jogo (congelado).

## A Forja em uma frase

Objeto novo **nasce no estúdio → passa no crítico → só então ganha uma linha em
`src/props.js`**. Nada entra no mundo sem passar pela régua.

```bash
npm run forja -- audit lobo          # crítico de um objeto
npm run forja -- shot lobo           # folha de contato (4 ângulos × 2 luzes)
npm run forja -- part jogador torso  # isola peças (esconde o tronco e filhos)
npm run forja -- sil jogador pe-lado # NOTA de silhueta vs referência (IoU + overlay)
npm run forja -- trace desenho.png   # desenho -> polígono (canal do ideador)
```

Documentação completa da bancada: **[`docs/FORJA.md`](docs/FORJA.md)**.
Fluxo de criação silhueta-primeiro: **[`.claude/skills/silhueta/SKILL.md`](.claude/skills/silhueta/SKILL.md)**.

## Mapa do repo

| Caminho | O quê |
|---|---|
| `src/lib/` | Biblioteca de qualidade: `loft.js` (malha orgânica), `silhouette.js` (vistas→3D), `geo.js` (chanfro/textura/paleta) |
| `src/makers.js` · `src/creature.js` | Construtores **puros** de objetos (Group na origem, chão em y=0) |
| `src/registry.js` | Catálogo: id, categoria, faixa de altura e orçamento de triângulos por objeto |
| `src/props.js` | Camada de **colocação** no mundo (só posiciona o que já foi aprovado) |
| `src/studio.js` · `studio.html` | O estúdio + o crítico + folhas de contato + nota de silhueta + traçador |
| `scripts/forja.mjs` | CLI da Forja (headless, via playwright-core) |
| `qa/ref/silhuetas.json` | Referências de silhueta (polígonos traçados de foto/desenho) |
| `docs/` | `FORJA.md`, `CONTINUITY.md` (save-game), `DECISIONS.md` |
| `src/main.js`, `terrain.js`, `combat.js`, ... | O jogo — congelado (ver DECISIONS D-2) |

## Regras invioláveis (herdadas do NÓS)

- Tudo voltado ao jogador em **pt-BR**; código, arquivos e commits em **inglês**.
- Nada de servidores fora do GitHub, nada de pay-to-win, nada de cripto/NFT.
- Toda mudança visual passa pela Forja (crítico verde) antes de entrar no mundo.

Convenções para quem desenvolve aqui (humano ou IA): **[`CLAUDE.md`](CLAUDE.md)**.

## Licença

Este projeto é [MIT](LICENSE) — use, copie e modifique à vontade. Se ele te ajudar em algo público, um crédito ao NÓS é bem-vindo.
