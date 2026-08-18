import { z } from 'zod';
import type { SharedMap, SharedNode } from './urlState';

export const MAP_FILE_EXTENSION = '.json';
const APP_MARKER = 'mind-weaver';
const FILE_VERSION = 1;

const nodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  collapsed: z.boolean().optional(),
});

const fileSchema = z.object({
  app: z.literal(APP_MARKER),
  v: z.number(),
  title: z.string(),
  nodes: z.array(nodeSchema).min(1),
});

/**
 * Serializes the whole map, manual positions included. Unlike a share link this
 * has no length ceiling, so it is the fallback for maps too big to fit a URL.
 */
export function serializeMap(map: SharedMap): string {
  return JSON.stringify(
    {
      app: APP_MARKER,
      v: FILE_VERSION,
      title: map.title,
      nodes: map.nodes.map(stripToSchema),
    },
    null,
    2,
  );
}

export function parseMapFile(contents: string): SharedMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('That file is not a valid Mind Weaver map.');
  }

  const result = fileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('That file is not a valid Mind Weaver map.');
  }

  const nodes = result.data.nodes.map(stripToSchema);
  if (!nodes.some(n => n.parentId === null)) {
    throw new Error('That map has no root node.');
  }

  return { title: result.data.title, nodes };
}

/** Keeps only schema fields, so extras from older files never leak back in. */
function stripToSchema(node: SharedNode): SharedNode {
  const stripped: SharedNode = {
    id: node.id,
    parentId: node.parentId,
    text: node.text,
    x: node.x,
    y: node.y,
    color: node.color,
  };
  if (node.collapsed) stripped.collapsed = true;
  return stripped;
}

export function mapFileName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'mindmap'}${MAP_FILE_EXTENSION}`;
}
