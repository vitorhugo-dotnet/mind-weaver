## Plano

O problema provavelmente não é o tema do Windows. Pelo screenshot e pelo código, a camada que contém os nós/linhas está com `width: 0` e `height: 0`. No Firefox o `overflow-visible` ainda deixa parte do SVG aparecer, mas no Chrome/Blink isso costuma colapsar/clipping total.

### 1. Dar dimensões reais para a camada do mapa
- Trocar o wrapper transformado em `MindMapCanvas` de `width: 0` / `height: 0` para uma área grande e explícita, por exemplo `width: 10000px` e `height: 10000px`.
- Ajustar a origem do sistema de coordenadas para permitir nós em posições negativas sem clipping, usando um offset interno estável.

### 2. Tornar o SVG independente do tamanho do conteúdo
- Em `MindMapConnections`, adicionar `width`, `height` e `viewBox` explícitos.
- Manter `position: absolute`, `pointerEvents: none`, `overflow: visible` e stroke hardcoded.
- Renderizar o SVG como uma camada atrás dos nós, mas dentro da mesma camada de pan/zoom.

### 3. Blindar coordenadas inválidas
- Manter a validação antes de criar cada `<path>`.
- Trocar a checagem para `Number.isFinite(coord)`, que cobre `NaN`, `undefined` convertido, `Infinity` e valores inválidos.

### 4. Preservar exportação e interação
- Garantir que a mudança não inclua os botões globais no export.
- Manter os nós clicáveis acima das linhas usando `z-index` apropriado.

### Resultado esperado
As linhas passam a aparecer no Chrome e Firefox porque o SVG deixa de depender de uma caixa colapsada em `0x0`, evitando o bug de renderização/clipping do Blink.