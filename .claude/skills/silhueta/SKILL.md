---
name: silhueta
description: Criar ou melhorar um objeto/parte 3D do NÓS-Craft pelo fluxo silhueta-primeiro — desenhar vistas 2D (1, 2 ou 3), inflar pra malha com fromViews()/lathe(), e medir com nota objetiva (forja sil). Use sempre que for criar peça nova, corrigir forma de peça existente, ou quando o ideador enviar um desenho/foto de referência.
---

# Silhueta-primeiro — o workflow de criação de objetos da Forja

## Por que existe

Autorar coordenadas 3D cruas usa a IA na sua fraqueza (chutar o efeito
espacial de um float e aprovar o próprio chute). Este fluxo usa a força:
raciocinar sobre FORMAS em 2D, com uma régua numérica externa. Origem:
ronda 8 da Forja (`docs/FORJA.md`), pivô pedido pelo ideador.

## O fluxo, passo a passo

1. **Escolha quantas vistas o objeto precisa** (decisão sua, por objeto):

   | Vistas | Quando | Ferramenta |
   |---|---|---|
   | **1** — perfil | objeto de revolução: pote, poço, torre, pilar | `lathe()` de `src/lib/geo.js` |
   | **2** — lado (z×y) + cima (z×x) | o caso comum: pé, tronco de bicho, barco, casa alongada | `fromViews({ lado, cima })` |
   | **3** — + frente (x×y) | quando 2 vistas não fecham a forma (afina de frente mas não de lado, ex.: cabeça, torso humano) | `fromViews({ lado, cima, frente })` |

   Regra: comece com 2; só acrescente a frontal se a folha de contato
   mostrar a forma errada de frente. Não desenhe vista que não muda nada.

2. **Obtenha os polígonos das vistas** (~10-18 pontos, FECHADOS):
   - **Desenho do ideador ou foto real** → `npm run forja -- trace <img> [pts]`
     — contorno fechado de traço escuro (ou forma preenchida) sobre fundo
     claro vira polígono automaticamente. É o canal de participação do
     ideador: ele desenha uma vista, você traça e usa.
   - **Sem desenho** → autore os pontos na mão MAS pense em 2D (é um
     desenho, não coordenadas 3D): comece pelos pontos extremos (topo,
     base, frente, trás) e preencha o contorno entre eles.
   - Convenção: y pra cima; unidades livres (normalize ao usar); lado é
     z×y (z pra frente), cima é z×x, frente é x×y.

3. **Infle** com `fromViews()` (`src/lib/silhouette.js`). Parâmetros que
   importam: `squareBottom` alto (4-6) = base/sola plana; `squareTop`
   ~2 = dorso redondo; `stations`/`seg` controlam resolução (13×10 já fica
   orgânico; cheque o orçamento de tris do crítico).
   **Concavidade dentro de uma vista** (vão entre pernas, buraco, arco)
   não sai de um inflate só: componha MASSAS — um `fromViews` por massa
   (torso, perna, braço), como uma model sheet real. Detalhe pequeno
   (dedo, orelha, maçaneta) pode continuar sendo primitiva avulsa
   meio-afundada na massa.

4. **Meça — "está realmente bom?" é número, não opinião:**
   - Registre a referência em `qa/ref/silhuetas.json` (polígono + `hide`
     + `yaw`/`pitch` da câmera). Se a vista veio de desenho/foto, o MESMO
     polígono do trace serve de referência.
   - `npm run forja -- sil <id> <ref>` → IoU + overlay em
     `qa/out/sil-<id>-<ref>.png` mostrando ONDE foge.
   - Leitura: **>85%** forma bate; **70-85%** desvio visível — abra o
     overlay e nomeie o defeito; **<70%** reprova, volte ao passo 2.
   - Itere EDITANDO PONTOS do desenho, nunca ajustando a malha na mão.

5. **Macro**: `npm run forja -- shot <id>` com o objeto inteiro — peça
   perfeita isolada ainda pode desandar a proporção do conjunto. Depois
   `npm run forja -- audit` (budget/chão/escala/anatomia) e `npm test`.

## Armadilhas conhecidas (pagas com sangue, ver docs/FORJA.md rondas 7-8)

- Nota CAIU depois de um ajuste? Abra o overlay antes de reagir — na
  ronda 8 isso revelou bug na régua, não no pé.
- Isolar peças usa `forja part <id> <esconder,...>` — lista do que
  ESCONDER (esconder `torso` some com tudo que é filho dele).
- Nomeie toda peça nova (`Object3D.name`) — é o que permite isolar e o
  que o checador de anatomia usa pra apontar qual peça flutua.
- trace(): o desenho precisa de contorno FECHADO (o flood-fill fecha o
  miolo sozinho) e fundo claro; ajuste `limiar` se o traço for fraco.
