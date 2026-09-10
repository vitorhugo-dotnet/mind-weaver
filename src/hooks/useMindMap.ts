import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOrCreateDefaultMap, saveNodes, updateMapTitle, createMapWithNodes, resetMap,
  newNodeId, type MindMap, type MindMapNode,
} from '@/lib/db';
import { applyLayout, getChildColor, getNodeDepth } from '@/lib/layout';
import { readMapFromUrl, clearMapFromUrl, buildShareUrl, type SharedMap } from '@/lib/urlState';
import { serializeMap, mapFileName } from '@/lib/mapFile';

export function useMindMap() {
  const [map, setMap] = useState<MindMap | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const needsLayout = useRef(false);

  const initialLayoutDone = useRef(false);

  useEffect(() => {
    const shared = readMapFromUrl();
    // A shared link lands in a NEW map: opening someone else's link must never
    // overwrite the map the user already had open.
    const load = shared?.nodes.length
      ? createMapWithNodes(shared.title || 'Shared Map', shared.nodes)
      : getOrCreateDefaultMap();

    load.then(({ map, nodes }) => {
      if (shared) clearMapFromUrl();
      setMap(map);
      setNodes(nodes);
      setLoading(false);
    });
  }, []);

  const debouncedSave = useCallback((mapId: number, updatedNodes: MindMapNode[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveNodes(mapId, updatedNodes);
    }, 500);
  }, []);

  const updateNodes = useCallback((updatedNodes: MindMapNode[], runLayout = false) => {
    const final = runLayout ? applyLayout(updatedNodes) : updatedNodes;
    setNodes(final);
    if (map?.id) debouncedSave(map.id, final);
  }, [map, debouncedSave]);

  const rootNode = nodes.find(n => n.parentId === null);

  const addChild = useCallback((parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent || !map?.id) return;

    const depth = getNodeDepth(parentId, nodes) + 1;

    const newNode: MindMapNode = {
      id: newNodeId(),
      mapId: map.id,
      parentId,
      text: '',
      x: 0,
      y: 0,
      color: getChildColor(depth),
    };

    const updated = [...nodes, newNode];
    updateNodes(updated, true);
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
    return newNode.id;
  }, [nodes, map, updateNodes]);

  const addSibling = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId || !map?.id) return;

    const depth = getNodeDepth(nodeId, nodes);
    const newNode: MindMapNode = {
      id: newNodeId(),
      mapId: map.id,
      parentId: node.parentId,
      text: '',
      x: 0,
      y: 0,
      color: getChildColor(depth),
    };

    const updated = [...nodes, newNode];
    updateNodes(updated, true);
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
    return newNode.id;
  }, [nodes, map, updateNodes]);

  const updateNodeText = useCallback((nodeId: string, text: string) => {
    const updated = nodes.map(n => n.id === nodeId ? { ...n, text } : n);
    updateNodes(updated);
  }, [nodes, updateNodes]);

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    const updated = nodes.map(n => n.id === nodeId ? { ...n, x, y } : n);
    updateNodes(updated);
  }, [nodes, updateNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) return;

    const toDelete = new Set<string>();
    const collectChildren = (id: string) => {
      toDelete.add(id);
      nodes.filter(n => n.parentId === id).forEach(child => collectChildren(child.id));
    };
    collectChildren(nodeId);

    const updated = nodes.filter(n => !toDelete.has(n.id));
    updateNodes(updated, true);
    setSelectedNodeId(node.parentId);
  }, [nodes, updateNodes]);

  const autoLayout = useCallback(() => {
    if (!rootNode || !map?.id) return;
    updateNodes(nodes, true);
  }, [nodes, rootNode, map, updateNodes]);

  const toggleCollapse = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const updated = nodes.map(n => n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n);
    updateNodes(updated, true);
  }, [nodes, updateNodes]);

  /** The full tree, collapsed branches included — never just what is on screen. */
  const asSharedMap = useCallback((): SharedMap => ({
    title: map?.title ?? '',
    nodes,
  }), [map, nodes]);

  const getShareUrl = useCallback(() => buildShareUrl(asSharedMap()), [asSharedMap]);

  const getMapFile = useCallback(() => {
    const shared = asSharedMap();
    return { name: mapFileName(shared.title), contents: serializeMap(shared) };
  }, [asSharedMap]);

  const importMap = useCallback(async (incoming: SharedMap) => {
    const created = await createMapWithNodes(incoming.title || 'Imported Map', incoming.nodes);
    setMap(created.map);
    setNodes(applyLayout(created.nodes));
    setSelectedNodeId(created.nodes.find(n => n.parentId === null)?.id ?? null);
    setEditingNodeId(null);
  }, []);

  // Compute visible nodes (filter out children of collapsed nodes)
  const visibleNodes = (() => {
    const hiddenSet = new Set<string>();
    const collectHidden = (parentId: string) => {
      nodes.filter(n => n.parentId === parentId).forEach(child => {
        hiddenSet.add(child.id);
        collectHidden(child.id);
      });
    };
    nodes.filter(n => n.collapsed).forEach(n => collectHidden(n.id));
    return nodes.filter(n => !hiddenSet.has(n.id));
  })();

  const setTitle = useCallback((title: string) => {
    if (!map?.id) return;
    setMap(prev => prev ? { ...prev, title } : prev);
    updateMapTitle(map.id, title);
  }, [map]);

  // Pasting a link into a tab that already has the app open only changes the
  // hash, so nothing remounts. Pick it up here instead.
  useEffect(() => {
    const onHashChange = () => {
      const shared = readMapFromUrl();
      if (!shared?.nodes.length) return;
      clearMapFromUrl();
      importMap(shared);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [importMap]);

  /** Resets the map on screen only. Other maps the user imported stay put. */
  const clearMap = useCallback(async () => {
    if (!map?.id) return;
    const root = await resetMap(map.id);
    setNodes([root]);
    setSelectedNodeId(root.id);
    setEditingNodeId(null);
  }, [map]);

  return {
    map, nodes: visibleNodes, allNodes: nodes, loading,
    selectedNodeId, setSelectedNodeId,
    editingNodeId, setEditingNodeId,
    rootNode,
    addChild, addSibling,
    updateNodeText, updateNodePosition,
    deleteNode, setTitle, autoLayout,
    toggleCollapse, clearMap,
    getShareUrl, getMapFile, importMap,
  };
}
