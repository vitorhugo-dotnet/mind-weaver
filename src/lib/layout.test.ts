import { describe, it, expect } from 'vitest';
import { applyLayout, getChildColor, getNodeDepth, NODE_COLORS } from './layout';
import type { MindMapNode } from './db';

function node(id: string, parentId: string | null, text = id): MindMapNode {
  return { id, mapId: 1, parentId, text, x: 999, y: 999, color: 'none' };
}

describe('getChildColor', () => {
  it('cycles through the palette by depth', () => {
    expect(getChildColor(0)).toBe(NODE_COLORS[0]);
    expect(getChildColor(1)).toBe(NODE_COLORS[1]);
    expect(getChildColor(NODE_COLORS.length)).toBe(NODE_COLORS[0]);
  });
});

describe('getNodeDepth', () => {
  it('counts the hops from a node up to the root', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'a')];
    expect(getNodeDepth('r', nodes)).toBe(0);
    expect(getNodeDepth('a', nodes)).toBe(1);
    expect(getNodeDepth('b', nodes)).toBe(2);
  });
});

describe('applyLayout', () => {
  it('places the root at the origin', () => {
    const laid = applyLayout([node('r', null)]);
    expect(laid[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('places children one horizontal gap to the right of the root', () => {
    const laid = applyLayout([node('r', null), node('a', 'r')]);
    expect(laid.find(n => n.id === 'a')!.x).toBe(250);
  });

  it('spreads siblings symmetrically around the root', () => {
    const laid = applyLayout([node('r', null), node('a', 'r'), node('b', 'r')]);
    const a = laid.find(n => n.id === 'a')!;
    const b = laid.find(n => n.id === 'b')!;
    expect(a.y).toBe(-b.y);
    expect(a.y).toBeLessThan(b.y);
  });

  it('leaves nodes hidden under a collapsed parent untouched', () => {
    const nodes = [node('r', null), { ...node('a', 'r'), collapsed: true }, node('b', 'a')];
    const laid = applyLayout(nodes);
    expect(laid.find(n => n.id === 'b')).toMatchObject({ x: 999, y: 999 });
  });

  it('is deterministic for the same input', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'r'), node('c', 'a')];
    expect(applyLayout(nodes)).toEqual(applyLayout(nodes));
  });

  it('returns the input unchanged when there is no root', () => {
    const orphans = [node('a', 'missing')];
    expect(applyLayout(orphans)).toEqual(orphans);
  });
});
