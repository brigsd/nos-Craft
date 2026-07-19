# Continuidade — onde paramos (NÓS-Craft)

> O "save game" do desenvolvimento. Toda sessão **começa lendo isto** e
> **termina atualizando**. Sessão que não atualiza a continuidade é sessão
> perdida. (Regra da casa do NÓS.)

## Estado atual — 2026-07-19 (ronda 9)

**O foco é A Forja** (a bancada de ferramentas), não o jogo — ver
`docs/DECISIONS.md` D-2. O motor do jogo funciona e está congelado.

### O que existe e está verde
- **23 objetos no registro** (`src/registry.js`), todos passando no crítico:
  vegetação (árvores, rocha), construções (casa, taverna, ponte, arco-portal),
  props (poço, santuário, tenda, fogueira, estandarte, estaca, pedra-portal),
  criaturas (lobo, javali, gnolls, NPCs) e heróis (jogador, presa-torta).
  Orçamento por categoria em `BUDGET`: veg 900 / prop 2600 / build 5200 /
  creature 3200 / hero 5200 tris.
- **Testes de lógica: 5/5** (`npm test` — combate, quests, dados).
- **Três ferramentas**: Estúdio (`studio.html`), Crítico + folhas de contato +
  nota de silhueta + traçador (`scripts/forja.mjs`), Cartógrafo
  (`cartografo.html`). Detalhe em `docs/FORJA.md`.

### Biblioteca de qualidade (`src/lib/`)
- `loft.js` — malha orgânica por seções (membros, troncos, focinhos). `clampBelow`
  achata sola/base. `countershade` pinta ventre/dorso.
- `silhouette.js` — `fromViews({lado, cima, frente?})`: desenhos 2D → malha 3D.
- `geo.js` — chanfro de caixa, paleta em rampas, texturas de canvas, `statsOf`.

### Últimas rondas (log completo em `docs/FORJA.md`)
- **7** — fluxo micro→macro (isolar peça: `forja part`) + perna do bípede
  redesenhada; pé em L (malha única + `clampBelow`).
- **8** — silhueta-primeiro + nota objetiva (`forja sil`, IoU vs referência).
  Dois bugs da própria régua achados e corrigidos na primeira usada.
- **9** — multi-vista (`fromViews` 1/2/3 vistas) + traçador de desenho
  (`forja trace`, canal do ideador) + skill `.claude/skills/silhueta/`.

## Próximos passos (candidatos, não obrigações)
1. **Estrear o canal de desenho do ideador**: ele desenha uma vista, `forja
   trace` converte, `fromViews` infla — refazer uma parte a partir do desenho
   dele de ponta a ponta.
2. **Traçar referências pras outras vistas** (pé de cima, mão, perfil do corpo)
   e refazer as demais partes do bípede no fluxo silhueta-primeiro.
3. **Costura da copa** ("vão entre lobos" na árvore) — anotado desde a ronda 5,
   ainda em aberto.
4. Auditar/melhorar os objetos que ainda são só caixa/loft antigo (casa e
   taverna acusam 12 materiais — candidatos a fundir draw calls).

## Congelado (não mexer sem pedido do ideador)
Motor do jogo: `main.js`, `terrain.js`, `combat.js`, `quests.js`, `entities.js`,
`ui.js`, `audio.js`, `save.js`, `index.html`. Integração com o portal do NÓS
(world.json, outbox, registry) nunca começou — fica pra fase-jogo, se voltar.
