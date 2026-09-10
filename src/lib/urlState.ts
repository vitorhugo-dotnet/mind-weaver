import LZString from 'lz-string';
import { applyLayout, getChildColor } from './layout';
import { newNodeId } from './db';

/**
 * A mind map reduced to what a shared link needs to carry: the title and the
 * tree of texts. Colors and positions are derived on the way out, so they only
 * travel in the payload when the user has dragged nodes off the auto-layout.
 */
export interface SharedNode {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  collapsed?: boolean;
}

export interface SharedMap {
  title: string;
  nodes: SharedNode[];
}

/**
 * Links longer than this survive in browsers but get truncated or wrapped by
 * chat apps and mail clients, so the share dialog steers users to a file export.
 */
export const SAFE_URL_LENGTH = 2000;

const FORMAT_VERSION = 1;
const FLAG_COLLAPSED = 1;

/** `[text, flags, children]` — the on-the-wire shape of one node. */
type PackedNode = [string, number, PackedNode[]];

interface Payload {
  v: number;
  t: string;
  r: PackedNode;
}

function childrenOf(nodes: SharedNode[], id: string): SharedNode[] {
  return nodes.filter(n => n.parentId === id);
}

function pack(nodes: SharedNode[], node: SharedNode): PackedNode {
  return [
    node.text,
    node.collapsed ? FLAG_COLLAPSED : 0,
    childrenOf(nodes, node.id).map(child => pack(nodes, child)),
  ];
}

export function encodeMap(map: SharedMap): string {
  const root = map.nodes.find(n => n.parentId === null);
  if (!root) return '';

  const payload: Payload = {
    v: FORMAT_VERSION,
    t: map.title,
    r: pack(map.nodes, root),
  };

  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeMap(payload: string): SharedMap | null {
  let parsed: Payload;
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    parsed = JSON.parse(json) as Payload;
  } catch {
    return null;
  }

  if (parsed?.v !== FORMAT_VERSION || !Array.isArray(parsed.r)) return null;

  const nodes: SharedNode[] = [];
  const unpack = (packed: PackedNode, parentId: string | null, depth: number) => {
    const [text, flags, children] = packed;
    if (typeof text !== 'string') throw new Error('malformed node');

    const node: SharedNode = {
      id: newNodeId(),
      parentId,
      text,
      x: 0,
      y: 0,
      color: getChildColor(depth),
    };
    if (flags & FLAG_COLLAPSED) node.collapsed = true;
    nodes.push(node);

    (Array.isArray(children) ? children : []).forEach(child => unpack(child, node.id, depth + 1));
  };

  try {
    unpack(parsed.r, null, 0);
  } catch {
    return null;
  }

  return {
    title: parsed.t ?? '',
    nodes: applyLayout(nodes as Parameters<typeof applyLayout>[0]) as SharedNode[],
  };
}

/**
 * Decodes links shared before the compact format existed. Those payloads carry
 * whole node records, base64 images included; only the schema fields survive.
 */
function decodeLegacyMap(payload: string): SharedMap | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed?.nodes) || parsed.nodes.length === 0) return null;

    return {
      title: parsed.map?.title ?? '',
      nodes: parsed.nodes.map((n: Record<string, unknown>) => {
        const node: SharedNode = {
          id: String(n.id ?? newNodeId()),
          parentId: n.parentId == null ? null : String(n.parentId),
          text: String(n.text ?? ''),
          x: Number(n.x) || 0,
          y: Number(n.y) || 0,
          color: String(n.color ?? getChildColor(0)),
        };
        if (n.collapsed) node.collapsed = true;
        return node;
      }),
    };
  } catch {
    return null;
  }
}

export function readMapFromUrl(hash: string = window.location.hash): SharedMap | null {
  const compact = hash.match(/[#&]m=([^&]+)/);
  if (compact) return decodeMap(compact[1]);

  const legacy = hash.match(/[#&]map=([^&]+)/);
  if (legacy) return decodeLegacyMap(legacy[1]);

  return null;
}

export function buildShareUrl(map: SharedMap, base?: string): string {
  const origin = base ?? `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${origin.replace(/#.*$/, '')}#m=${encodeMap(map)}`;
}

/** Drops the shared payload from the address bar once it has been imported. */
export function clearMapFromUrl() {
  if (!window.location.hash) return;
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
