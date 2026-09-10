import { Plus, Trash2 } from 'lucide-react';

interface FloatingToolbarProps {
  hasSelection: boolean;
  isRoot: boolean;
  position?: { x: number; y: number } | null;
  onAddChild: () => void;
  onDelete: () => void;
}

export function FloatingToolbar({ hasSelection, isRoot, position, onAddChild, onDelete }: FloatingToolbarProps) {
  if (!hasSelection || !position) return null;

  return (
    <div
      data-export-ignore
      className="fixed bg-toolbar text-toolbar-foreground rounded-xl shadow-2xl px-2 py-1.5 flex items-center gap-1 z-50 -translate-x-1/2 -translate-y-full"
      style={{ left: position.x, top: position.y - 16 }}
    >
      <button
        onClick={onAddChild}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors text-sm"
        title="Add child (Tab)"
      >
        <Plus className="w-4 h-4" />
        <span>Add child</span>
      </button>

      {!isRoot && (
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors text-sm"
          title="Delete (Del)"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}
