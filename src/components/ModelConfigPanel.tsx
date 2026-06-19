import { useState } from 'react';
import { Shield, Trash2, Plus, Star, StarOff, Eye, EyeOff, Key, Edit3, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { useModelConfigs } from '@/hooks/useModelConfigs';
import { useToast } from '@/context/ToastContext';
import { PROVIDER_PRESETS, PROVIDER_LABELS, DEFAULT_MODEL_ID, DEFAULT_MODEL_NAME } from '@/lib/constants';
import type { AIProvider } from '@/types/app';

export function ModelConfigPanel() {
  const { configs, loading, storeModelKey, deleteModelKey, setDefault, getGlobalKey } = useModelConfigs();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const [showGlobalKey, setShowGlobalKey] = useState(false);
  const [globalKey, setGlobalKey] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalTestState, setGlobalTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const globalConfig = getGlobalKey();

  const testApiKey = async (key: string): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { ok: true, message: 'Key is valid' };
      const body = await res.json().catch(() => ({}));
      return { ok: false, message: body.error?.message || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  };

  const handleTestGlobalKey = async () => {
    if (!globalKey.trim()) return;
    setGlobalTestState('testing');
    const result = await testApiKey(globalKey.trim());
    setGlobalTestState(result.ok ? 'success' : 'error');
    if (result.ok) toast.success('Global key is valid');
    else toast.error(`Key test failed: ${result.message}`);
    setTimeout(() => setGlobalTestState('idle'), 4000);
  };

  const handleSaveGlobalKey = async () => {
    if (!globalKey.trim()) return;
    setSavingGlobal(true);
    await storeModelKey('openrouter', '__global__', 'OpenRouter Global Key', globalKey.trim());
    setSavingGlobal(false);
    setGlobalKey('');
    setShowGlobalKey(false);
    toast.success('Global OpenRouter key saved');
  };

  const handleSave = async () => {
    if (!modelId.trim() || !apiKey.trim()) return;
    setSaving(true);
    await storeModelKey(provider, modelId.trim(), displayName.trim() || modelId.trim(), apiKey.trim());
    setSaving(false);
    setProvider('openai');
    setModelId('');
    setDisplayName('');
    setApiKey('');
    setShowAdd(false);
  };

  const customConfigs = configs.filter((c) => !(c.provider === 'openrouter' && c.model_id === '__global__'));

  const allPresetModels = PROVIDER_PRESETS.filter((p) =>
    p.provider === provider && (!modelSearch || p.models.some((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase())))
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Built-in model */}
      <div className="glass-surface rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h4 className="font-medium text-zinc-200">{DEFAULT_MODEL_NAME}</h4>
              <Badge variant="success">Built-in</Badge>
            </div>
            <p className="text-xs text-zinc-500 font-mono">{DEFAULT_MODEL_ID}</p>
            <p className="text-xs text-zinc-600 mt-1">Small, fast model — costs ~$0.65 per million tokens. Uses your global API key.</p>
          </div>
        </div>
      </div>

      {/* OpenRouter Global Key */}
      <div className="glass-surface rounded-xl p-4 border-brand-800/30">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-brand-300" />
              <h4 className="font-medium text-zinc-200">OpenRouter API Key</h4>
              <Badge>Global</Badge>
              {globalConfig && <Badge variant="success">Set</Badge>}
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Used for all AI models unless a per-model key is configured below. Without this key, only the system default is available.
            </p>
            {globalConfig ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-400 font-mono">
                  {showGlobalKey ? '••••••••••••••••' : '••••••••••••••••••••••••••••'}
                </p>
                <button onClick={() => setShowGlobalKey(!showGlobalKey)} className="btn-ghost p-1.5">
                  {showGlobalKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setShowGlobalKey(true); setGlobalKey(''); }} className="btn-ghost p-1.5">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteModelKey(globalConfig.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <Input
                    type="password"
                    value={globalKey}
                    onChange={(e) => { setGlobalKey(e.target.value); setGlobalTestState('idle'); }}
                    placeholder="sk-or-v1-..."
                    className="max-w-sm"
                  />
                  <Button onClick={handleTestGlobalKey} loading={globalTestState === 'testing'} size="sm" variant="secondary" className="h-[42px]" disabled={!globalKey.trim()}>
                    {globalTestState === 'testing' ? 'Testing...' : 'Test'}
                  </Button>
                  <Button onClick={handleSaveGlobalKey} loading={savingGlobal} size="sm" className="h-[42px]" disabled={globalTestState === 'error' || !globalKey.trim()}>
                    Save Key
                  </Button>
                </div>
                {globalTestState === 'success' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Key is valid
                  </div>
                )}
                {globalTestState === 'error' && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <XCircle className="w-3.5 h-3.5" /> Key test failed
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom models */}
      {customConfigs.map((config) => (
        <div key={config.id} className="glass-surface rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-zinc-200">{config.display_name || config.model_id}</h4>
                <Badge>{PROVIDER_LABELS[config.provider]}</Badge>
                {config.is_default && <Badge variant="success">Default</Badge>}
              </div>
              <p className="text-xs text-zinc-500 font-mono">{config.model_id}</p>
            </div>
            <div className="flex items-center gap-1">
              {!config.is_default && (
                <button onClick={() => setDefault(config.id)} className="btn-ghost p-1.5" title="Set as default">
                  <StarOff className="w-3.5 h-3.5" />
                </button>
              )}
              {config.is_default && (
                <button className="btn-ghost p-1.5 text-amber-400" disabled title="Current default">
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
              <button onClick={() => deleteModelKey(config.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300" title="Delete model">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {customConfigs.length === 0 && !loading && (
        <EmptyState
          icon="🤖"
          title="No custom models"
          description="Add your own AI model keys to unlock Claude, GPT-4, Gemini, and more."
          action={<Button variant="secondary" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Model</Button>}
        />
      )}

      {customConfigs.length > 0 && (
        <Button variant="secondary" onClick={() => setShowAdd(true)} className="self-start">
          <Plus className="w-4 h-4" />
          Add Model
        </Button>
      )}

      {/* Add model modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add AI Model">
        <div className="flex flex-col gap-4">
          <Select
            label="Provider"
            value={provider}
            onChange={(e) => { setProvider(e.target.value as AIProvider); setModelId(''); }}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'google', label: 'Google' },
              { value: 'openrouter', label: 'OpenRouter (Custom)' },
            ]}
          />

          {provider !== 'openrouter' && (
            <div className="flex flex-col gap-2">
              <Select
                label="Model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                options={[
                  { value: '', label: '— Select or type below —' },
                  ...allPresetModels.flatMap((p) =>
                    p.models.map((m) => ({ value: m.id, label: `${m.name} (${m.id})` }))
                  ),
                ]}
              />
              <Input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="Or type OpenRouter model ID..."
              />
            </div>
          )}

          {provider === 'openrouter' && (
            <Input
              label="Model ID"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. meta-llama/llama-4-maverick:free"
            />
          )}

          <Input label="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="My GPT-4o" />
          <Input label="API Key" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTestState('idle'); }} placeholder="sk-..." type="password" />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!apiKey.trim()) { toast.warning('Enter an API key first'); return; }
                setTestState('testing');
                const result = await testApiKey(apiKey.trim());
                setTestState(result.ok ? 'success' : 'error');
                if (result.ok) toast.success('API key is valid');
                else toast.error(`Key test failed: ${result.message}`);
                setTimeout(() => setTestState('idle'), 4000);
              }}
              loading={testState === 'testing'}
              disabled={!apiKey.trim()}
            >
              {testState === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {testState === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {testState === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
          </div>

          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Your API key is encrypted and stored securely in Supabase Vault.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!modelId.trim() || !apiKey.trim() || testState === 'error'}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
