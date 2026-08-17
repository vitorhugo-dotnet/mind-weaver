import { useRef, useState } from 'react';
import { Download, Share2, FileText, Upload, Check, Copy, AlertTriangle, Image, FileJson } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parseMapFile } from '@/lib/mapFile';
import { SAFE_URL_LENGTH, type SharedMap } from '@/lib/urlState';

interface TopNavBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExportPng: () => void;
  getShareUrl: () => string;
  getMapFile: () => { name: string; contents: string };
  onImport: (map: SharedMap) => void | Promise<void>;
}

function downloadText(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function TopNavBar({
  title, onTitleChange, onExportPng, getShareUrl, getMapFile, onImport,
}: TopNavBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const openShare = () => {
    setShareUrl(getShareUrl());
    setCopied(false);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard permission denied — the input below is selectable as a fallback.
      setCopied(false);
    }
  };

  const exportJson = () => {
    const file = getMapFile();
    downloadText(file.name, file.contents, 'application/json');
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    try {
      await onImport(parseMapFile(await file.text()));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'That file could not be imported.');
    }
  };

  const tooLong = !!shareUrl && shareUrl.length > SAFE_URL_LENGTH;

  return (
    <div data-export-ignore className="fixed top-0 left-0 right-0 h-12 bg-navbar text-navbar-foreground flex items-center px-4 z-50 shadow-md">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <input
            className="bg-transparent border-none outline-none text-sm font-medium text-navbar-foreground placeholder:text-navbar-foreground/50 w-48"
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Untitled Map"
            aria-label="Map title"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-md hover:bg-primary/20 transition-colors"
          title="Import a .json map"
          aria-label="Import map"
        >
          <Upload className="w-4 h-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-2 rounded-md hover:bg-primary/20 transition-colors"
            title="Export"
            aria-label="Export"
          >
            <Download className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportJson}>
              <FileJson className="w-4 h-4 mr-2" />
              Download .json
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPng}>
              <Image className="w-4 h-4 mr-2" />
              Download .png
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={openShare}
          className="p-2 rounded-md hover:bg-primary/20 transition-colors"
          title="Share"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={shareUrl !== null} onOpenChange={open => !open && setShareUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this map</DialogTitle>
            <DialogDescription>
              The whole map travels inside the link — nothing is uploaded anywhere. Anyone
              who opens it gets their own editable copy.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl ?? ''}
              onFocus={e => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm font-mono"
              aria-label="Share link"
            />
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {shareUrl?.length ?? 0} characters
            {tooLong ? '' : ' — short enough to paste anywhere.'}
          </p>

          {tooLong && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
              <p>
                This map is big enough that some chat apps and mail clients may cut the link
                short. Download the <strong>.json</strong> file instead and send that.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importError !== null} onOpenChange={open => !open && setImportError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import failed</DialogTitle>
            <DialogDescription>{importError}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
