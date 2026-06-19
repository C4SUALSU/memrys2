import { Brain, X } from 'lucide-react';
import { Button } from './ui/Button';

interface BatchActionBarProps {
  selectedCount: number;
  onForward: () => void;
  onCancel: () => void;
}

export function BatchActionBar({ selectedCount, onForward, onCancel }: BatchActionBarProps) {
  return (
    <div className="animate-slide-up glass-surface border-t border-zinc-800/50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-300">
          {selectedCount} selected
        </span>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <Button variant="primary" onClick={onForward} disabled={selectedCount === 0} size="sm">
        <Brain className="w-4 h-4" />
        Forward to Brain Dump
      </Button>
    </div>
  );
}
