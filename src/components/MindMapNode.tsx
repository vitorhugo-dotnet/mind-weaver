import { useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { MindMapNode as NodeType } from '@/lib/db';

interface MindMapNodeProps {
  node: NodeType;
  isSelected: boolean;
  isEditing: boolean;
  isRoot: boolean;
  childCount: number;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onTextChange: (text: string) => void;
  onToggleCollapse: () => void;
}

export function MindMapNodeComponent({
  node, isSelected, isEditing, isRoot, childCount,
  onSelect, onStartEdit, onStopEdit, onTextChange, onToggleCollapse,
}: MindMapNodeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const textStyle = isRoot
    ? 'text-xl font-extrabold text-foreground'
    : 'text-sm font-medium text-foreground/80';

  const selectedRing = isSelected
    ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas shadow-md'
    : '';

  const isCollapsed = !!node.collapsed;

  return (
    <div
      className="absolute z-10"
      style={{
        left: node.x,
        top: node.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={`relative select-none flex flex-col items-center justify-center whitespace-nowrap cursor-pointer transition-all duration-150 px-3 py-1 bg-canvas rounded-md ${textStyle} ${selectedRing}`}
        style={{
          ...(isSelected && !isRoot ? { color: node.color } : {}),
          ...(isRoot ? { color: 'hsl(var(--foreground))' } : {}),
        }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            className="bg-transparent outline-none text-center min-w-[60px] border-b-2 border-primary"
            value={node.text}
            onChange={e => onTextChange(e.target.value)}
            onBlur={onStopEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                onStopEdit();
              }
            }}
            style={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}
          />
        ) : (
          <span>{node.text || 'New topic'}</span>
        )}

        {childCount > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="absolute top-1/2 -translate-y-1/2 -right-7 w-5 h-5 rounded-full bg-canvas border-2 flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 transition-transform"
            style={{ borderColor: node.color, color: node.color }}
            title={isCollapsed ? `Expand (${childCount})` : 'Collapse'}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <span className="leading-none">{childCount}</span>
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
