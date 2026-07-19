# Guia de Troubleshooting de Modelagem e Geometria — A FORJA

Este documento registra problemas comuns de renderização, geometria e dados identificados durante o desenvolvimento e auditoria de modelos 3D na Forja, junto com suas soluções.

---

## 1. Tampas Invisíveis ou Concavidade Escura no Loft (`loft.js`)

### Sintoma
- A ponta ou base de um objeto feito com `loft` (ex.: talo, membro, tronco) parece esburacada, vazada ou com uma concavidade escura em formato de lua crescente, mesmo quando `capStart: true` ou `capEnd: true` está ativo.
- Ao olhar de cima ou de lado, a base do modelo parece transparente ou "cortada".

### Causa Raiz (Bug Geométrico)
Inversão da ordem de enrolamento dos vértices (*winding order*) na geração de tampas em `src/lib/loft.js`:
- Os triângulos gerados para fechar o tubo tinham normais voltadas para **dentro** da malha em vez de para **fora**.
- O renderizador (Three.js) aplica *backface culling* (descarte de faces traseiras) e ignora a tampa ao olhar pelo lado de fora, revelando o interior oco e sem iluminação do cilindro.

### Solução
Em `src/lib/loft.js`, a ordem dos índices dos triângulos da tampa foi corrigida para garantir que a normal atenda à regra da mão direita (voltada para fora):

```javascript
// ANTES (normais invertidas para dentro):
if (flip > 0) idx.push(ci, base + j, base + ((j + 1) % seg));
else idx.push(ci, (j + 1) % seg, j);

// DEPOIS (normais corretas para fora):
if (flip > 0) idx.push(ci, base + ((j + 1) % seg), base + j);
else idx.push(ci, j, (j + 1) % seg);
```

---

## 2. Recortes Serrilhados na Base (Z-Fighting no Solo)

### Sintoma
- O modelo ganha bordas pretas picotadas, cintilação ou partes "comidas" exatamente na linha onde toca a grade/chão.

### Causa Raiz
*Z-fighting*: Os polígonos da tampa inferior do modelo estão exatamente na mesma altura Y (`y = 0.0`) que os polígonos da grade/chão do estúdio. A GPU não consegue decidir qual polígono está à frente.

### Solução
Usar uma das duas estratégias no modelo declarativo JSON:
1. **Elevação Mínima:** Definir a primeira seção do modelo em `y = 0.01` com `capSmooth: false` para que a base plana flutue 1cm acima do chão.
2. **Sepultamento de Raiz:** Deixar a primeira seção começar em `y = -0.05` ou usar `capSmooth: true` para que a curvatura entre suavemente no solo.

---

## 3. Desvios de Proporção e Excesso de Material (`forja sil`)

### Sintoma
- O relatório do `forja sil` ou `forja ronda` acusa `IoU < 85%` ou aponta mensagens como:
  `! proporção: 9% mais alto/fino que a referência`
  `+ sobra material em topo-dir (+6%)`

### Causa Raiz
As coordenadas 2D do perfil de inflação (`side` / `top` em `inflate`) ou a posição/raio das seções do `loft` estão desalinhadas em relação à imagem/vetor de referência.

### Solução
- Consultar a imagem de overlay gerada em `qa/out/sil-<id>-<vista>.png`.
- Ajustar diretamente os valores no arquivo JSON correspondente em `src/models/<id>.json` sem alterar código JS:
  - Reduzir raio (`rx`/`rz`) na região acusada com sobra (`+`).
  - Aumentar raio na região acusada com falta (`-`).
  - Ajustar a escala (`scale`) se o desvio for global.

---

## 4. Draw Calls Excessivas (`[warn] drawcalls`)

### Sintoma
- O relatório do `forja audit` exibe aviso: `△ 12 materiais (mais material = mais draw call; funda o que der)`.

### Causa Raiz
Muitos nós do objeto possuem materiais independentes com propriedades ligeiramente diferentes.

### Solução
- Garantir que cores repetidas utilizem o cache de materiais memoizados `M(color)` exportado por `src/lib/model-builder.js`.
- Agrupar materiais da mesma família na paleta declarativa.
