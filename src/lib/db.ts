import Dexie, { type Table } from 'dexie';
import { getChildColor } from './layout';

export interface MindMap {
  id?: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapNode {
  id: string;
  mapId: number;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  collapsed?: boolean;
}

class MindMapDB extends Dexie {
  maps!: Table<MindMap, number>;
  nodes!: Table<MindMapNode, string>;

  constructor() {
    super('MindMapDB');
    this.version(1).stores({
      maps: '++id, title, createdAt, updatedAt',
      nodes: 'id, mapId, parentId',
    });
    // v2 dropped node images. Reclaims the base64 payloads v1 databases still hold.
    this.version(2)
      .stores({
        maps: '++id, title, createdAt, updatedAt',
        nodes: 'id, mapId, parentId',
      })
      .upgrade(tx => tx.table('nodes').toCollection().modify(node => {
        delete (node as { image?: string }).image;
      }));
  }
}

export const db = new MindMapDB();

/** A node arriving from a share link or a file, before it belongs to a map. */
export type IncomingNode = Omit<MindMapNode, 'mapId'>;

export function newNodeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `n${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function getOrCreateDefaultMap(): Promise<{ map: MindMap; nodes: MindMapNode[] }> {
  const maps = await db.maps.orderBy('updatedAt').reverse().toArray();
  if (maps.length > 0) {
    const map = maps[0];
    const nodes = await db.nodes.where('mapId').equals(map.id!).toArray();
    return { map, nodes };
  }

  const rootId = newNodeId();
  const mapId = await db.maps.add({
    title: 'My First Mind Map',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const rootNode: MindMapNode = {
    id: rootId,
    mapId: mapId as number,
    parentId: null,
    text: 'Central Idea',
    x: 0,
    y: 0,
    color: getChildColor(0),
  };

  await db.nodes.add(rootNode);
  const map = await db.maps.get(mapId as number);
  return { map: map!, nodes: [rootNode] };
}

/**
 * Stores an incoming map (a share link or an imported file) as a NEW map, so
 * opening someone else's link never overwrites what the user already had.
 * Node ids are re-minted because the nodes table is keyed globally.
 */
export async function createMapWithNodes(
  title: string,
  incoming: IncomingNode[],
): Promise<{ map: MindMap; nodes: MindMapNode[] }> {
  const now = new Date();
  const mapId = (await db.maps.add({ title, createdAt: now, updatedAt: now })) as number;

  const idByOldId = new Map(incoming.map(n => [n.id, newNodeId()]));
  const nodes: MindMapNode[] = incoming.map(n => {
    const node: MindMapNode = {
      id: idByOldId.get(n.id)!,
      mapId,
      parentId: n.parentId === null ? null : idByOldId.get(n.parentId) ?? null,
      text: n.text,
      x: n.x,
      y: n.y,
      color: n.color,
    };
    if (n.collapsed) node.collapsed = true;
    return node;
  });

  await db.nodes.bulkAdd(nodes);
  const map = await db.maps.get(mapId);
  return { map: map!, nodes };
}

export async function saveNodes(mapId: number, nodes: MindMapNode[]) {
  await db.transaction('rw', db.nodes, db.maps, async () => {
    await db.nodes.where('mapId').equals(mapId).delete();
    await db.nodes.bulkAdd(nodes);
    await db.maps.update(mapId, { updatedAt: new Date() });
  });
}

/** Empties one map back to a single root node, leaving every other map alone. */
export async function resetMap(mapId: number): Promise<MindMapNode> {
  const root: MindMapNode = {
    id: newNodeId(),
    mapId,
    parentId: null,
    text: 'Central Idea',
    x: 0,
    y: 0,
    color: getChildColor(0),
  };
  await saveNodes(mapId, [root]);
  return root;
}

export async function updateMapTitle(mapId: number, title: string) {
  await db.maps.update(mapId, { title, updatedAt: new Date() });
}

