import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import {
  encodeMap, decodeMap, buildShareUrl, readMapFromUrl, SAFE_URL_LENGTH,
  type SharedMap, type SharedNode,
} from './urlState';
import { applyLayout, getChildColor } from './layout';
import type { MindMapNode } from './db';

const WORDS = ['Projeto', 'Marketing', 'Backend', 'Pesquisa', 'Roadmap', 'Contrato'];

/** Builds a laid-out map of `n` nodes, each child attached to an earlier node. */
function buildMap(n: number, title = 'Meu Mapa'): SharedMap {
  const nodes: MindMapNode[] = [
    { id: 'n0', mapId: 1, parentId: null, text: 'Ideia Central', x: 0, y: 0, color: 'x' },
  ];
  for (let i = 1; i < n; i++) {
    nodes.push({
      id: `n${i}`, mapId: 1, parentId: `n${Math.floor((i - 1) / 3)}`,
      text: `${WORDS[i % WORDS.length]} ${i}`, x: 0, y: 0, color: 'x',
    });
  }
  return { title, nodes: applyLayout(nodes) };
}

/** Parent/child shape, independent of the generated ids. */
function structure(map: SharedMap): string[] {
  const label = (n: SharedNode): string => {
    const parent = map.nodes.find(p => p.id === n.parentId);
    return parent ? `${label(parent)}>${n.text}` : n.text;
  };
  return map.nodes.map(label).sort();
}

describe('encodeMap / decodeMap', () => {
  it('round-trips the title and the tree structure', () => {
    const original = buildMap(12, 'Planejamento 2026');
    const decoded = decodeMap(encodeMap(original))!;

    expect(decoded.title).toBe('Planejamento 2026');
    expect(structure(decoded)).toEqual(structure(original));
  });

  it('keeps a 30-node map link well under the safe URL length', () => {
    const url = buildShareUrl(buildMap(30), 'https://mind.hugojava.dev/');
    expect(url.length).toBeLessThan(SAFE_URL_LENGTH);
    expect(url.length).toBeLessThan(1000);
  });

  it('derives node colors from depth instead of storing them', () => {
    const original = buildMap(10);
    original.nodes.forEach(n => { n.color = 'hsl(999, 0%, 0%)'; });

    const decoded = decodeMap(encodeMap(original))!;
    const root = decoded.nodes.find(n => n.parentId === null)!;
    const child = decoded.nodes.find(n => n.parentId === root.id)!;

    expect(root.color).toBe(getChildColor(0));
    expect(child.color).toBe(getChildColor(1));
  });

  it('preserves collapsed nodes', () => {
    const original = buildMap(8);
    original.nodes[1].collapsed = true;

    const decoded = decodeMap(encodeMap(original))!;
    const collapsed = decoded.nodes.filter(n => n.collapsed);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].text).toBe(original.nodes[1].text);
  });

  // The canvas re-runs the auto-layout on every load, so coordinates in a link
  // could never be honoured. Leaving them out keeps the link as short as possible.
  it('never carries coordinates, however the nodes were dragged', () => {
    const tidy = buildMap(20);
    const dragged: SharedMap = {
      ...tidy,
      nodes: tidy.nodes.map((n, i) => (i === 5 ? { ...n, x: n.x + 137, y: n.y - 42 } : n)),
    };

    expect(encodeMap(dragged)).toBe(encodeMap(tidy));
  });

  it('lays the map out from the tree alone when decoding', () => {
    const map = buildMap(15);
    const decoded = decodeMap(encodeMap(map))!;

    const laid = applyLayout(decoded.nodes as never);
    expect(decoded.nodes.map(n => [n.x, n.y])).toEqual(laid.map(n => [n.x, n.y]));
    expect(decoded.nodes.find(n => n.parentId === null)).toMatchObject({ x: 0, y: 0 });
    expect(decoded.nodes.some(n => n.x === 250)).toBe(true);
  });

  it('never serializes fields outside the schema, such as attached images', () => {
    const clean = buildMap(10);
    const withImage = buildMap(10);
    (withImage.nodes[3] as SharedNode & { image?: string }).image =
      'data:image/png;base64,' + 'A'.repeat(200_000);

    expect(encodeMap(withImage).length).toBe(encodeMap(clean).length);
  });

  it('returns null for a corrupt payload', () => {
    expect(decodeMap('not-a-real-payload')).toBeNull();
    expect(decodeMap('')).toBeNull();
  });

  it('returns null for a payload whose tree has no root', () => {
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, t: 'x', r: null }));
    expect(decodeMap(payload)).toBeNull();
  });
});

describe('readMapFromUrl', () => {
  it('reads the compact hash', () => {
    const original = buildMap(6, 'Do link');
    const hash = `#m=${encodeMap(original)}`;

    expect(readMapFromUrl(hash)!.title).toBe('Do link');
  });

  it('still reads links shared with the legacy #map= format', () => {
    const legacy = {
      map: { title: 'Link Antigo' },
      nodes: [
        { id: 'a', mapId: 1, parentId: null, text: 'Raiz', x: 0, y: 0, color: 'hsl(1, 1%, 1%)' },
        { id: 'b', mapId: 1, parentId: 'a', text: 'Filho', x: 250, y: 0, color: 'hsl(2, 2%, 2%)' },
      ],
    };
    const hash = `#map=${LZString.compressToEncodedURIComponent(JSON.stringify(legacy))}`;

    const decoded = readMapFromUrl(hash)!;
    expect(decoded.title).toBe('Link Antigo');
    expect(structure(decoded)).toEqual(['Raiz', 'Raiz>Filho']);
  });

  it('drops image data carried by legacy links', () => {
    const legacy = {
      map: { title: 'Com Imagem' },
      nodes: [{
        id: 'a', mapId: 1, parentId: null, text: 'Raiz', x: 0, y: 0,
        color: 'hsl(1, 1%, 1%)', image: 'data:image/png;base64,AAAA',
      }],
    };
    const hash = `#map=${LZString.compressToEncodedURIComponent(JSON.stringify(legacy))}`;

    const decoded = readMapFromUrl(hash)!;
    expect(decoded.nodes[0]).not.toHaveProperty('image');
  });

  it('returns null when there is no map in the hash', () => {
    expect(readMapFromUrl('')).toBeNull();
    expect(readMapFromUrl('#something-else')).toBeNull();
  });
});
