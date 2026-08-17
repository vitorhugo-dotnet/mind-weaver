import type { MindMapNode } from './db';

export const NODE_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(340, 82%, 52%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
];

export const HORIZONTAL_GAP = 250;
export const VERTICAL_GAP = 80;

export function getChildColor(depth: number): string {
  return NODE_COLORS[depth % NODE_COLORS.length];
}

export function getNodeDepth(nodeId: string, nodes: MindMapNode[]): number {
  let depth = 0;
  let current = nodes.find(n => n.id === nodeId);
  while (current?.parentId) {
    depth++;
    current = nodes.find(n => n.id === current!.parentId);
  }
  return depth;
}

export function applyLayout(inputNodes: MindMapNode[]): MindMapNode[] {
  const root = inputNodes.find(n => n.parentId === null);
  if (!root) return inputNodes;

  const childrenMap = new Map<string, MindMapNode[]>();
  inputNodes.forEach(n => {
    if (n.parentId) {
      const siblings = childrenMap.get(n.parentId) || [];
      siblings.push(n);
      childrenMap.set(n.parentId, siblings);
    }
  });

  const subtreeHeight = new Map<string, number>();
  function calcHeight(id: string): number {
    const node = inputNodes.find(n => n.id === id);
    const children = node?.collapsed ? [] : (childrenMap.get(id) || []);
    if (children.length === 0) { subtreeHeight.set(id, VERTICAL_GAP); return VERTICAL_GAP; }
    const h = children.reduce((sum, c) => sum + calcHeight(c.id), 0);
    subtreeHeight.set(id, h);
    return h;
  }
  calcHeight(root.id);

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(root.id, { x: 0, y: 0 });

  function layout(id: string, x: number, yStart: number) {
    const node = inputNodes.find(n => n.id === id);
    const children = node?.collapsed ? [] : (childrenMap.get(id) || []);
    let yOffset = yStart;
    children.forEach(child => {
      const h = subtreeHeight.get(child.id) || VERTICAL_GAP;
      positions.set(child.id, { x, y: yOffset + h / 2 });
      layout(child.id, x + HORIZONTAL_GAP, yOffset);
      yOffset += h;
    });
  }

  const totalH = subtreeHeight.get(root.id) || 0;
  layout(root.id, HORIZONTAL_GAP, -totalH / 2);

  return inputNodes.map(n => {
    const pos = positions.get(n.id);
    return pos ? { ...n, ...pos } : n;
  });
}
