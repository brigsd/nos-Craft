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
| **Crítico + folhas de contato** | `scripts/forja.mjs` | `audit` (budget/chão/escala/drawcalls/anatomia-peça-órfã), `shot` (4 ângulos × 2 luzes), `part` (isola peças — MICRO), `diff` (antes/depois), `all` |
| **Cartógrafo** | `cartografo.html` / `src/cartografo.js` | mapa de cima 100% Canvas2D — roda a MESMA geração do jogo (terrain+props) numa Scene nunca renderizada, plota POIs/estrada/rio/colisores/densidade |

```bash
npm run forja -- audit              # audita tudo (exit 1 se error)
npm run forja -- audit lobo         # só um objeto
npm run forja -- shot lobo          # folha de contato -> qa/out/forja-lobo.png
npm run forja -- part jogador torso # esconde o tronco (some cabeça/braços junto) -> forja-jogador-isolado.png
npm run forja -- sil jogador pe-lado # nota de silhueta vs referência traçada de foto -> sil-jogador-pe-lado.png
npm run forja -- diff lobo          # compara qa/baseline/ vs qa/out/ (antes/depois)
npm run forja -- all                # audita + fotografa tudo
```
Abrir `cartografo.html` num navegador (ou via server local) dá o mapa
interativo com toggles de camada e leitura de altura/coordenada no cursor.

## O fluxo MICRO → MACRO (isolar pra detalhar, montar pra ver se combina)

Achado do ideador (Forja ronda 7): tronco, braço e cabeça escondem defeito
de junta nas pernas — só aparecem isolando. Daí o fluxo padrão pra criar OU
melhorar qualquer parte de um objeto com juntas (bípede, quadrúpede, o que
vier):

1. **MICRO — isola a peça.** `npm run forja -- part <id> <peças a esconder>`
   (ou no navegador: `__ST__.show(id); __ST__.hide(['torso'])`). Esconder um
   nome esconde tudo que é filho dele (`torso` leva junto cabeça/braços/
   ombreiras/pescoço) — então só sobra a peça que você quer olhar de perto,
   SEM o resto do corpo tapando o defeito ou distraindo o olho.
2. **Audite e melhore SÓ aquilo.** Regra do olhar de sempre: aponte o
   defeito concreto (ponta de cone numa tampa que devia ficar aberta, anel
   de junta, proporção errada) antes de qualquer elogio. Corrija no código,
   re-rode o `part` até a peça isolada ler bem sozinha.
3. **MACRO — monta de novo.** `npm run forja -- shot <id>` (folha de
   contato do objeto INTEIRO). Uma peça perfeita sozinha pode não combinar
   com o resto (proporção, altura total, cor) — o crítico (`audit`) pega
   escala/chão/drawcalls automaticamente, mas COERÊNCIA visual entre partes
   só o olho vê na folha inteira.
4. Só então commit. Isolado bonito + montado incoerente = não terminou.

Nomes ficam em `Object3D.name` nos construtores (`torso`, `head`, `pelvis`,
`legL`/`legR`, `shinL`/`shinR`, ...) — dar nome a uma peça nova É o que a
torna isolável e é também o que o crítico usa pra apontar QUAL peça flutua
num achado de anatomia (em vez de só o índice numérico).

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

7. **Isolar peça → fluxo micro/macro (`forja part`)** — pedido do ideador:
   isolar a perna (escondendo o tronco) revelou 2 defeitos que o corpo
   inteiro escondia — ponta de cone no topo da coxa (a tampa do loft não
   devia existir ali, a seção fica dentro da pélvis) e um anel em losango
   no "joelho" (duas tampas de pontas vizinhas se encontrando). Fix:
   `loft()` ganhou `capStart`/`capEnd` independentes (antes só dava pra
   tampar as DUAS pontas ou nenhuma); coxa e canela não tampam mais nas
   pontas que se tocam, e ganharam curvatura real (bulbo do quadríceps,
   batata da perna) em vez de cone reto. Pé trocado de caixa-bota pra pé
   descalço com dedos (fileira de 4 esferas achatadas). Bônus: o
   `isolate`/`hide` do estúdio nasceu como lista-do-que-MOSTRAR e quebrou
   na primeira vez que dei nome a uma peça nova (a canela sumiu junto sem
   aviso) — virou lista-do-que-ESCONDER, mais robusta a nomes futuros.

8. **Silhueta-primeiro + nota objetiva (`lib/silhouette.js` + `forja sil`)**
   — diagnóstico do ideador: "a abordagem está errada pra IA trabalhar" —
   autorar coordenadas 3D cruas usa a IA na fraqueza (chutar o efeito
   espacial de um float) e ignora a força (raciocinar sobre formas 2D).
   Agora a peça é DESENHADA em dois perfis 2D (lateral z×y + planta z×x,
   como ficha de model sheet) e `inflate()` vira malha 3D com seções
   superelipse (expoentes separados topo/baixo = sola plana + dorso
   redondo por construção). E o "está realmente bom?" virou número:
   `forja sil <id> <ref>` compara a silhueta renderizada com um polígono
   traçado de foto real (qa/ref/silhuetas.json) por IoU e grava overlay
   mostrando ONDE foge. Guia de leitura: >85% forma bate; 70-85% tem
   desvio visível — abra o overlay; <70% reprova. Dois bugs da própria
   régua achados e corrigidos NA PRIMEIRA USADA: (a) cor de fundo via
   THREE.Color dava valores linear-space vs framebuffer sRGB — máscara
   marcava o fundo todo como objeto; (b) normalização por bbox esticado
   perdoava proporção errada e oscilava por re-registro — trocada por
   escala uniforme + sola alinhada, proporção agora custa nota. O pé do
   bípede foi refeito nesse workflow: 3 iterações de EDITAR PONTOS 2D com
   nota de feedback (58%→90% com régua frouxa; 77%→87.7% com régua
   honesta), coisa que na ronda 7 eram chutes cegos de coordenadas.

9. **Multi-vista + traçador + skill (formalização)** — pedido do ideador:
   ele quer PARTICIPAR desenhando vistas. (a) `fromViews({lado, cima,
   frente?})` — a IA escolhe quantas vistas o objeto precisa (1 = lathe;
   2 = o comum; 3 = a frontal RECORTA cada seção, visual hull de model
   sheet); concavidade dentro de uma vista = compor massas, um fromViews
   por massa. (b) `forja trace <img>` — desenho de contorno fechado (ou
   forma preenchida) em fundo claro vira polígono automaticamente
   (binariza → flood-fill fecha o miolo → maior componente → contorno
   Moore → Douglas-Peucker). Validado ponta-a-ponta: a ref pe-lado
   desenhada como traço de caneta voltou com 17 pontos e proporções
   certas. O MESMO desenho serve de perfil de entrada E de régua do sil.
   (c) Tudo virou skill: `.claude/skills/silhueta/SKILL.md` — qualquer
   sessão futura carrega o fluxo completo com as armadilhas documentadas.

Cada ronda: **audite, olhe a folha de contato de verdade, aponte o defeito
concreto antes de aprovar, corrija, re-audite.** Não se dê por satisfeito.
E antes de concluir qualquer ronda visual: **"está REALMENTE bom?"** —
rode `forja sil` se houver referência, e se não houver, trace uma
(qa/ref/silhuetas.json, ~10-16 pontos olhando uma foto real).

## Como o ideador participa desenhando

1. Desenhe UMA vista por imagem: contorno fechado, traço escuro, fundo
   claro (papel fotografado serve). Diga qual objeto e qual vista é
   ("lado do lobo", "frente da casa").
2. O coder roda `npm run forja -- trace <img>` → polígono.
3. O polígono vira perfil de entrada do `fromViews()` E referência em
   `qa/ref/silhuetas.json` — a malha nasce do seu desenho e é medida
   contra ele. Vista que você não desenhar, o coder desenha (e diz que
   foi ele, pra você poder corrigir).
