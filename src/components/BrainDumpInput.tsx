import { useState } from 'react';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useModelConfigs } from '@/hooks/useModelConfigs';
import { DEFAULT_MODEL_ID, DEFAULT_MODEL_NAME } from '@/lib/constants';

interface BrainDumpInputProps {
  text: string;
  onTextChange: (text: string) => void;
  onParse: (modelConfigId?: string, apiKey?: string) => Promise<void>;
  onReset: () => void;
  isProcessing: boolean;
}

export function BrainDumpInput({ text, onTextChange, onParse, onReset, isProcessing }: BrainDumpInputProps) {
  const { configs, getDefault } = useModelConfigs();
  const [selectedModel, setSelectedModel] = useState<string>('default');
  const defaultConfig = getDefault();

  const modelOptions = [
    { value: 'default', label: `${DEFAULT_MODEL_NAME} (Default)` },
    ...configs.map((c) => ({
      value: c.id,
      label: `${c.display_name || c.model_id} (${c.provider})`,
    })),
  ];

  const handleParse = () => {
    const configId = selectedModel === 'default' ? undefined : selectedModel;
    onParse(configId);
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Type your thoughts naturally... e.g. 'Dinner with Sarah next Thursday at 7pm, dentist tomorrow at 10am, submit taxes by April 15'"
        rows={5}
        className="input-field resize-none text-base leading-relaxed"
        disabled={isProcessing}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Select
            options={modelOptions}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onReset} disabled={isProcessing || !text} size="sm">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button onClick={handleParse} loading={isProcessing} disabled={!text.trim()} size="sm">
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Parse Brain Dump
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
