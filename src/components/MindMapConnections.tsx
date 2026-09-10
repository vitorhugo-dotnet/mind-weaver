import type { MindMapNode } from '@/lib/db';

interface Props {
  nodes: MindMapNode[];
  allNodes: MindMapNode[];
}

// Horizontal offset so lines start/end clear of the node's toggle button
const START_X_OFFSET = 18;
const END_X_OFFSET = 8;

export function MindMapConnections({ nodes }: Props) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={10000}
      height={10000}
      viewBox="0 0 10000 10000"
      className="overflow-visible"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 10000,
        height: 10000,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible',
      }}
    >
      {nodes.filter(n => n.parentId).map(node => {
        const parent = nodeMap.get(node.parentId!);
        if (!parent) return null;

        const goingRight = node.x >= parent.x;
        const startX = parent.x + (goingRight ? START_X_OFFSET : -START_X_OFFSET);
        const startY = parent.y;
        const endX = node.x + (goingRight ? -END_X_OFFSET : END_X_OFFSET);
        const endY = node.y;

        const dx = endX - startX;
        const cx1 = startX + dx * 0.4;
        const cy1 = startY;
        const cx2 = startX + dx * 0.6;
        const cy2 = endY;

        const coordinates = [startX, startY, cx1, cy1, cx2, cy2, endX, endY];
        if (coordinates.some(coord => !Number.isFinite(coord))) {
          return null;
        }

        return (
          <path
            key={`${parent.id}-${node.id}`}
            d={`M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}
