# NÓS-Craft — Harness do repo

Você está no **NÓS-Craft**, o primeiro Ramo de guerra do NÓS. Hoje este repo é,
acima de tudo, **A Forja**: a bancada de ferramentas que cria e audita os
objetos 3D do mundo. Three.js vendorizado, roda no navegador sem build step.

## Antes de qualquer trabalho

1. Leia `docs/CONTINUITY.md` — onde paramos e o próximo passo.
2. Decisões já tomadas estão em `docs/DECISIONS.md` — não re-discuta sem fato novo.
3. Trabalho na Forja (criar/melhorar objeto)? `docs/FORJA.md` é a bancada, e o
   fluxo de criação está na skill `silhueta` (`.claude/skills/silhueta/SKILL.md`).

## O foco (pivô do ideador, DECISIONS D-2)

**Não tente terminar o jogo.** O trabalho é a ferramenta. Objetos mais bonitos,
realistas e otimizados são a prova de que a ferramenta melhorou — use isso como
alavanca pra melhorar a Forja ainda mais. **Não se dê por satisfeito quase
nunca**, e antes de aprovar qualquer resultado visual pergunte: *o que tem de
errado nisso? o que seria mais realista? como levar a ferramenta mais longe?* —
nomeie o defeito concreto **antes** de qualquer elogio.

## Regras invioláveis

- **Regra da casa (D-3):** objeto novo nasce em `studio.html` → passa no crítico
  (`npm run forja -- audit`) → só então ganha uma linha em `src/props.js`.
  `makers.js`/`creature.js` só têm construtores **puros** (Group na origem, chão
  em y=0). Nunca posicione no mundo dentro de um construtor.
- **A régua é número (D-5):** o "está realmente bom?" se responde com o crítico
  (`audit`) e, havendo referência, com a nota de silhueta (`forja sil`). Se não
  houver referência, trace uma (`forja trace` num desenho/foto, ou ~10-16 pontos
  na mão) — não aprove só no olho.
- Tudo voltado ao jogador em **pt-BR**; código, arquivos e commits em **inglês**.
- Nada fora do GitHub, nada de pay-to-win, nada de cripto/NFT.
- Toda peça nova ganha `Object3D.name` — é o que permite isolar (`forja part`) e
  o que o checador de anatomia usa pra apontar qual peça flutua.

## Fluxo padrão de uma ronda

construir/desenhar → `forja audit` (crítico) → `forja sil` (nota, se houver ref)
→ olhar a folha de contato de verdade e nomear o defeito → corrigir → re-auditar
→ macro (`forja shot` do objeto inteiro pra checar coerência) → `npm test` →
commit + push → **registrar a ronda em `docs/FORJA.md` e atualizar
`docs/CONTINUITY.md`.**

## Ao encerrar a sessão

Atualize `docs/CONTINUITY.md`. Sessão que não atualiza a continuidade é sessão
perdida.
