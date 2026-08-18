import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, getOrCreateDefaultMap, saveNodes, createMapWithNodes, resetMap, type MindMapNode } from './db';
import type { SharedNode } from './urlState';

const sharedNodes: SharedNode[] = [
  { id: 's1', parentId: null, text: 'Mapa Compartilhado', x: 0, y: 0, color: 'hsl(217, 91%, 60%)' },
  { id: 's2', parentId: 's1', text: 'Tópico', x: 250, y: 0, color: 'hsl(262, 83%, 58%)' },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('createMapWithNodes', () => {
  it('stores the nodes under a brand new map', async () => {
    const { map, nodes } = await createMapWithNodes('Do Link', sharedNodes);

    expect(map.id).toBeTypeOf('number');
    expect(map.title).toBe('Do Link');
    expect(nodes.map(n => n.text)).toEqual(['Mapa Compartilhado', 'Tópico']);
    expect(nodes.every(n => n.mapId === map.id)).toBe(true);
  });

  it('keeps the parent/child links intact after re-assigning ids', async () => {
    const { nodes } = await createMapWithNodes('Do Link', sharedNodes);
    const root = nodes.find(n => n.parentId === null)!;
    const child = nodes.find(n => n.parentId !== null)!;

    expect(child.parentId).toBe(root.id);
  });

  it('leaves the maps the user already had untouched', async () => {
    const { map: mine } = await getOrCreateDefaultMap();
    await saveNodes(mine.id!, [
      { id: 'mine-1', mapId: mine.id!, parentId: null, text: 'Meu Mapa', x: 0, y: 0, color: 'c' },
    ] as MindMapNode[]);

    await createMapWithNodes('Do Link', sharedNodes);

    const stillMine = await db.nodes.where('mapId').equals(mine.id!).toArray();
    expect(stillMine.map(n => n.text)).toEqual(['Meu Mapa']);
  });

  it('gives imported nodes ids that cannot collide with existing nodes', async () => {
    const first = await createMapWithNodes('A', sharedNodes);
    const second = await createMapWithNodes('B', sharedNodes);

    const overlap = first.nodes.filter(a => second.nodes.some(b => b.id === a.id));
    expect(overlap).toEqual([]);
    expect(await db.nodes.count()).toBe(4);
  });
});

describe('getOrCreateDefaultMap', () => {
  it('opens the most recently updated map, so an import becomes the active one', async () => {
    const { map: older } = await getOrCreateDefaultMap();
    await db.maps.update(older.id!, { updatedAt: new Date('2020-01-01') });

    const imported = await createMapWithNodes('Do Link', sharedNodes);
    const active = await getOrCreateDefaultMap();

    expect(active.map.id).toBe(imported.map.id);
  });
});

describe('resetMap', () => {
  it('leaves the map holding a single empty root node', async () => {
    const { map } = await createMapWithNodes('A', sharedNodes);

    const root = await resetMap(map.id!);

    const remaining = await db.nodes.where('mapId').equals(map.id!).toArray();
    expect(remaining).toEqual([root]);
    expect(root).toMatchObject({ parentId: null, mapId: map.id });
  });

  it('does not touch the user\'s other maps', async () => {
    const a = await createMapWithNodes('A', sharedNodes);
    const b = await createMapWithNodes('B', sharedNodes);

    await resetMap(a.map.id!);

    expect(await db.nodes.where('mapId').equals(b.map.id!).count()).toBe(2);
    expect(await db.maps.count()).toBe(2);
  });
});

describe('saveNodes', () => {
  it('only replaces the nodes belonging to the map being saved', async () => {
    const a = await createMapWithNodes('A', sharedNodes);
    const b = await createMapWithNodes('B', sharedNodes);

    await saveNodes(a.map.id!, [
      { id: 'a-only', mapId: a.map.id!, parentId: null, text: 'Trocado', x: 0, y: 0, color: 'c' },
    ]);

    expect(await db.nodes.where('mapId').equals(a.map.id!).count()).toBe(1);
    expect(await db.nodes.where('mapId').equals(b.map.id!).count()).toBe(2);
  });
});
