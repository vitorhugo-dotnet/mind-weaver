import { describe, it, expect } from 'vitest';
import { serializeMap, parseMapFile, mapFileName } from './mapFile';
import type { SharedMap } from './urlState';

const sample: SharedMap = {
  title: 'Plano de Ação',
  nodes: [
    { id: 'a', parentId: null, text: 'Raiz', x: 0, y: 0, color: 'hsl(217, 91%, 60%)' },
    { id: 'b', parentId: 'a', text: 'Filho', x: 250, y: -40, color: 'hsl(262, 83%, 58%)', collapsed: true },
    { id: 'c', parentId: 'b', text: 'Neto', x: 500, y: -40, color: 'hsl(340, 82%, 52%)' },
  ],
};

describe('serializeMap / parseMapFile', () => {
  it('round-trips a map without losing nodes, positions or collapsed state', () => {
    expect(parseMapFile(serializeMap(sample))).toEqual(sample);
  });

  it('writes indented JSON so the file stays human-readable', () => {
    expect(serializeMap(sample)).toContain('\n  ');
  });

  it('rejects a file that is not valid JSON', () => {
    expect(() => parseMapFile('{ not json')).toThrow(/valid Mind Weaver/i);
  });

  it('rejects a JSON file that is not a Mind Weaver map', () => {
    expect(() => parseMapFile(JSON.stringify({ hello: 'world' }))).toThrow(/valid Mind Weaver/i);
  });

  it('rejects a map whose nodes have no root', () => {
    const rootless = { app: 'mind-weaver', v: 1, title: 'x', nodes: [sample.nodes[1]] };
    expect(() => parseMapFile(JSON.stringify(rootless))).toThrow(/root/i);
  });

  it('rejects a map with no nodes at all', () => {
    const empty = { app: 'mind-weaver', v: 1, title: 'x', nodes: [] };
    expect(() => parseMapFile(JSON.stringify(empty))).toThrow(/valid Mind Weaver/i);
  });

  it('drops image data left over from files written before images were removed', () => {
    const legacy = {
      app: 'mind-weaver', v: 1, title: 'x',
      nodes: [{ ...sample.nodes[0], image: 'data:image/png;base64,AAAA' }],
    };
    expect(parseMapFile(JSON.stringify(legacy)).nodes[0]).not.toHaveProperty('image');
  });
});

describe('mapFileName', () => {
  it('turns the map title into a safe file name', () => {
    expect(mapFileName('Plano de Ação 2026')).toBe('plano-de-acao-2026.json');
  });

  it('falls back to a default name for a blank title', () => {
    expect(mapFileName('   ')).toBe('mindmap.json');
  });
});
