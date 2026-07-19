# Decisões — NÓS-Craft

> Decisão registrada aqui não se re-discute sem fato novo. Formato: **D-N ·
> data · título** + o porquê. Espelha a disciplina do `docs/DECISIONS.md` do
> projeto-mãe.

## D-1 · 2026-07-17 · O que é o NÓS-Craft
O primeiro Ramo de guerra do NÓS: pegada de MMO clássico (estilo WoW-clássico)
no navegador, 100% dentro do GitHub — sem servidor próprio. Herda as regras
invioláveis do NÓS: player em pt-BR / código em inglês; nada fora do GitHub;
nada de pay-to-win; nada de cripto/NFT.

## D-2 · 2026-07-18 · O foco virou a FERRAMENTA, não o jogo *(pivô do ideador)*
Depois de um protótipo de jogo funcional porém visualmente cru, o ideador
redirecionou: **pare de tentar terminar o jogo; construa ferramentas de criação
de objetos o mais potentes possíveis.** Objetos bonitos/realistas/otimizados são
o combustível que prova que a ferramenta melhorou — não o produto final. O motor
do jogo fica **congelado** (funciona, não é apagado), e só volta a andar por
pedido explícito. Consequência prática: todo trabalho novo é na Forja
(`docs/FORJA.md`), medido por rondas de qualidade.

## D-3 · 2026-07-18 · Regra da casa — objeto nasce no estúdio
Objeto novo **nasce em `studio.html` → passa no crítico (`forja audit`) → só
então ganha uma linha em `src/props.js`.** `src/makers.js`/`creature.js` só têm
construtores **puros** (Group na origem, chão em y=0); quem posiciona no mundo é
`props.js`. Isso mantém cada objeto auditável isoladamente e impede que estado
de mundo entre em construtor.

## D-4 · 2026-07-18 · Three.js vendorizado, não via CDN nem npm-em-runtime
`vendor/three.module.min.js` + `vendor/three.core.min.js` (licença em
`vendor/THREE_LICENSE.md`). Motivo: o cliente roda no GitHub Pages sem build
step e sem rede externa em runtime — coerente com "nada fora do GitHub". O
`importmap` das páginas aponta pro vendor local.

## D-5 · 2026-07-18 · O crítico é a régua — "está realmente bom?" é número
Julgar arte só no olho (meu olho avaliando meu próprio trabalho) aceita fácil
demais. Então a Forja tem crítico algorítmico: orçamento de triângulos por
categoria, contato com o chão, escala vs. régua humana de 1.80m, draw calls,
peça órfã/anatomia. E a partir da ronda 8, **nota de silhueta** (IoU contra
referência traçada de foto real). Antes de aprovar qualquer ronda visual, a
pergunta é obrigatória e a resposta é um número.

## D-6 · 2026-07-19 · Silhueta-primeiro é a interface de criação para IA *(pivô do ideador)*
Autorar coordenadas 3D cruas usa a IA na fraqueza (chutar o efeito espacial de
um float). A criação passa a ser **desenhar vistas 2D** (1, 2 ou 3 conforme o
objeto) e inflar pra malha (`src/lib/silhouette.js`, `fromViews`). O ideador
participa **desenhando vistas** — `forja trace` converte desenho em polígono. O
fluxo virou skill carregável: `.claude/skills/silhueta/SKILL.md`.

## D-7 · 2026-07-19 · Disciplina de rondas + memória institucional
Cada avanço visual é uma **ronda** registrada em `docs/FORJA.md` (log de rondas):
o defeito concreto nomeado ANTES do elogio, a correção, a re-auditoria. As
mensagens de commit carregam o mesmo detalhe. Isso é a memória que uma sessão
fria recupera sem re-descobrir.

---

### Drift conhecido / dívidas
- **Script `gen-world` removido** (2026-07-19): apontava para
  `scripts/gen-world-json.mjs`, que nunca existiu no repo — resquício da
  fase-jogo. `world/` está vazio; a geração de mundo real vive em `terrain.js`
  + `props.js`, consumida pelo Cartógrafo.
- `scripts/screenshot.mjs` (`npm run olhar`) é o QA de screenshot da fase-jogo;
  segue vivo mas serve o motor congelado, não a Forja.
