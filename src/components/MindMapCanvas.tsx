import { useState, useCallback, useRef, useEffect } from 'react';
import { useMindMap } from '@/hooks/useMindMap';
import { FloatingToolbar } from './FloatingToolbar';
import { MindMapNodeComponent } from './MindMapNode';
import { MindMapConnections } from './MindMapConnections';
import { ExportFab } from './ExportFab';
import { TopNavBar } from './TopNavBar';
import { Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

export function MindMapCanvas() {
  const {
    map, nodes, allNodes, loading,
    selectedNodeId, setSelectedNodeId,
    editingNodeId, setEditingNodeId,
    rootNode,
    addChild, addSibling,
    updateNodeText, updateNodePosition,
    deleteNode, setTitle, autoLayout,
    toggleCollapse, clearMap,
    getShareUrl, getMapFile, importMap,
  } = useMindMap();

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleExport = useCallback(async () => {
    if (!exportRef.current) return;
    // Compute bounding box of all nodes for tight crop
    const padding = 80;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 200;
    const minY = Math.min(...ys) - 100;
    const maxX = Math.max(...xs) + 200;
    const maxY = Math.max(...ys) + 100;
    const width = Math.max(maxX - minX + padding * 2, 400);
    const height = Math.max(maxY - minY + padding * 2, 400);

    try {
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: undefined,
        cacheBust: true,
        pixelRatio: 2,
        filter: (el) => !(el instanceof HTMLElement && el.hasAttribute('data-export-ignore')),
        style: {
          transform: `translate(${-minX + padding}px, ${-minY + padding}px)`,
          transformOrigin: '0 0',
        },
        width,
        height,
      });
      const link = document.createElement('a');
      link.download = `${(map?.title || 'mindmap').replace(/[^\w-]+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  }, [nodes, map]);

  // Center canvas and auto-layout on first load
  useEffect(() => {
    if (!loading && rootNode && containerRef.current) {
      autoLayout();
      const rect = containerRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2 - rootNode.x, y: rect.height / 2 - rootNode.y });
      if (!selectedNodeId) setSelectedNodeId(rootNode.id);
    }
  }, [loading, rootNode?.id]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(3, Math.max(0.2, z * delta)));
  }, []);

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('[data-canvas-bg]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setSelectedNodeId(null);
    setEditingNodeId(null);
  }, [pan, setSelectedNodeId, setEditingNodeId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingNodeId) return;
      if (!selectedNodeId) return;

      const current = nodes.find(n => n.id === selectedNodeId);
      if (!current) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        addChild(selectedNodeId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (current.parentId) {
          addChild(current.parentId);
        } else {
          addChild(current.id);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const children = nodes.filter(n => n.parentId === current.id);
        const siblings = current.parentId
          ? nodes.filter(n => n.parentId === current.parentId).sort((a, b) => a.y - b.y)
          : [];
        const idx = siblings.findIndex(n => n.id === current.id);

        let nextId: string | null = null;
        if (e.key === 'ArrowRight' && children.length) {
          nextId = children.sort((a, b) => a.y - b.y)[0].id;
        } else if (e.key === 'ArrowLeft' && current.parentId) {
          nextId = current.parentId;
        } else if (e.key === 'ArrowUp' && idx > 0) {
          nextId = siblings[idx - 1].id;
        } else if (e.key === 'ArrowDown' && idx >= 0 && idx < siblings.length - 1) {
          nextId = siblings[idx + 1].id;
        }
        if (nextId) setSelectedNodeId(nextId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, editingNodeId, nodes, addChild, addSibling, deleteNode, setEditingNodeId, setSelectedNodeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas flex flex-col pt-12">
      <TopNavBar
        title={map?.title ?? ''}
        onTitleChange={setTitle}
        onExportPng={handleExport}
        getShareUrl={getShareUrl}
        getMapFile={getMapFile}
        onImport={importMap}
      />
      <div
        ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-canvas-bg
      >
        {/* Dot grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" data-canvas-bg>
          <defs>
            <pattern id="dots" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill="hsl(var(--canvas-dot))" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Zoom/Pan layer */}
        <div
          ref={exportRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 10000,
            height: 10000,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <MindMapConnections nodes={nodes} allNodes={allNodes} />
          {nodes.map(node => {
            const childCount = allNodes.filter(n => n.parentId === node.id).length;
            return (
              <MindMapNodeComponent
                key={node.id}
                node={node}
                isSelected={node.id === selectedNodeId}
                isEditing={node.id === editingNodeId}
                isRoot={node.parentId === null}
                childCount={childCount}
                onSelect={() => setSelectedNodeId(node.id)}
                onStartEdit={() => { setSelectedNodeId(node.id); setEditingNodeId(node.id); }}
                onStopEdit={() => setEditingNodeId(null)}
                onTextChange={(text) => updateNodeText(node.id, text)}
                onToggleCollapse={() => toggleCollapse(node.id)}
              />
            );
          })}
        </div>
      </div>

      {(() => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        const toolbarPos = selectedNode && containerRect
          ? {
              x: containerRect.left + pan.x + selectedNode.x * zoom,
              y: containerRect.top + pan.y + (selectedNode.y - 20) * zoom,
            }
          : null;
        return (
          <FloatingToolbar
            hasSelection={!!selectedNodeId}
            isRoot={selectedNode?.parentId === null}
            position={toolbarPos}
            onAddChild={() => selectedNodeId && addChild(selectedNodeId)}
            onDelete={() => selectedNodeId && deleteNode(selectedNodeId)}
          />
        );
      })()}

      <ExportFab onClear={clearMap} canClear={allNodes.length > 1} />
    </div>
  );
}
