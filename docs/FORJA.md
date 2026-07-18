# A Forja — bancada de ferramentas do NÓS-Craft

> Pivô do ideador: pare de tentar terminar o jogo; a ferramenta é o
> trabalho. Objetos bonitos/realistas são o combustível que prova que a
> ferramenta melhorou — não o produto final.

## Regra da casa

Objeto novo nasce no **estúdio** (`studio.html`), passa pelo **crítico**
(`scripts/forja.mjs audit`), só então ganha uma linha em `src/props.js`.
`src/makers.js` só tem construtores **puros** (Group na origem, chão em
y=0) — quem posiciona no mundo é `props.js`.

## As três ferramentas

| Ferramenta | Arquivo | Pra quê |
|---|---|---|
| **Estúdio** | `studio.html` / `src/studio.js` | um objeto por vez, 3 rigs de luz, turntable, wireframe, figura-referência 1.80m |
| **Crítico + folhas de contato** | `scripts/forja.mjs` | `audit` (budget/chão/escala/drawcalls/anatomia-peça-órfã), `shot` (4 ângulos × 2 luzes), `diff` (antes/depois), `all` |
| **Cartógrafo** | `cartografo.html` / `src/cartografo.js` | mapa de cima 100% Canvas2D — roda a MESMA geração do jogo (terrain+props) numa Scene nunca renderizada, plota POIs/estrada/rio/colisores/densidade |

```bash
npm run forja -- audit              # audita tudo (exit 1 se error)
npm run forja -- audit lobo         # só um objeto
npm run forja -- shot lobo          # folha de contato -> qa/out/forja-lobo.png
npm run forja -- diff lobo          # compara qa/baseline/ vs qa/out/ (antes/depois)
npm run forja -- all                # audita + fotografa tudo
```
Abrir `cartografo.html` num navegador (ou via server local) dá o mapa
interativo com toggles de camada e leitura de altura/coordenada no cursor.

## Biblioteca de qualidade (`src/lib/`)

- **`geo.js`**: chanfro de caixa (`chamferBox`), pintura de vértice com AO
  fake (`paintVerts`), paleta em rampas por família de material (`PAL`/`C`),
  texturas de canvas com pincel (tábuas, telhas, cantaria, pano),
  `displace` (fbm em vértices), `lathe` (sólido de revolução), `freeze`/
  `mergeGeos` (funde pra menos draw calls), `statsOf` (o crítico usa).
- **`loft.js`**: a primitiva que tirou os bichos/bonecos de "caixas de
  Lego" — malha por SEÇÕES ao longo de uma espinha, transporte paralelo
  (sem torção acumulada), normais suaves, tampas rasas (não leque-ponto,
  que estourava branco puro nas normas degeneradas). `countershade`
  pinta ventre/dorso.

## Log de rondas (o que o crítico já pagou)

1. **Materiais memoizados** — 13-15 draw calls por objeto viravam 2-9
   (cada `Mesh` criava seu próprio `MeshLambertMaterial`).
2. **Escala humana** — bípedes nasciam a 2.66m; fator `HUMAN=0.68` assenta
   em 1.80m (a régua do crítico).
3. **Loft nos quadrúpedes** — tronco/pescoço/focinho/cauda/4 patas em
   malha contínua. Achados corrigidos olhando a folha de contato, não só
   o código: patas flutuando (vão pata↔barriga), pontas brancas
   estourando (tampa em leque-ponto), lavado demais (contra-sombreado
   forte demais + luz-chave forte demais nas normais contínuas).
4. **Loft nos membros do bípede** — braço/perna deixaram de ter quina reta
   no cotovelo/joelho; ombreira esférica (bola de praia flutuando) virou
   cunha achatada cobrindo a junta.
5. **Tronco em loft nas árvores** — S-bend + afunilamento, custo zero (620
   instâncias reusam a mesma geometria). Achado e não corrigido ainda: leve
   gargalo onde a copa (blobs de icosaedro) encontra o topo do tronco.
6. **Checador de anatomia** — o ideador achou a olho um vão vazio entre a
   barriga e a cabeça do boneco; o crítico não pegava porque
   `Box3.setFromObject()` soma a bbox de todo descendente num pai, então
   uma peça-filha flutuando sempre "tocava" o próprio pai. Trocado por bbox
   da geometria própria de cada mesh (nível `error`, lista todos os
   achados). Isso desenterrou mais dois vãos reais: balde do poço
   flutuando sem corda, e anel de pedras da fogueira longe demais das
   toras. Ambos corrigidos e reauditados.

Cada ronda: **audite, olhe a folha de contato de verdade, aponte o defeito
concreto antes de aprovar, corrija, re-audite.** Não se dê por satisfeito.
