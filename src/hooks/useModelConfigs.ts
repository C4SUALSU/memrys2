import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserModelConfig } from '@/types/app';
import { useToast } from '@/context/ToastContext';

export function useModelConfigs() {
  const [configs, setConfigs] = useState<UserModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_model_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setConfigs(data as UserModelConfig[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const storeModelKey = useCallback(async (
    provider: string,
    modelId: string,
    displayName: string,
    apiKey: string,
  ) => {
    const { data, error } = await supabase.rpc('store_model_key', {
      p_provider: provider,
      p_model_id: modelId,
      p_display_name: displayName,
      p_api_key: apiKey,
    });

    if (error) {
      toast.error(`Failed to save model: ${error.message}`);
      return { error: error.message, data: null };
    }

    toast.success(`Model "${displayName || modelId}" saved securely`);
    await fetchConfigs();
    return { error: null, data };
  }, [fetchConfigs, toast]);

  const deleteModelKey = useCallback(async (configId: string) => {
    const { error } = await supabase.rpc('delete_model_key', { p_config_id: configId });

    if (error) {
      toast.error(`Failed to delete model: ${error.message}`);
      return { error: error.message };
    }

    toast.success('Model removed');
    setConfigs((prev) => prev.filter((c) => c.id !== configId));
    return { error: null };
  }, [toast]);

  const setDefault = useCallback(async (configId: string) => {
    const { error } = await supabase
      .from('user_model_configs')
      .update({ is_default: true })
      .eq('id', configId);

    if (!error) {
      await fetchConfigs();
      toast.success('Default model updated');
    } else {
      toast.error(`Failed: ${error.message}`);
    }

    return { error: error?.message ?? null };
  }, [fetchConfigs, toast]);

  const getDefault = useCallback(() => {
    return configs.find((c) => c.is_default) ?? null;
  }, [configs]);

  const getGlobalKey = useCallback(() => {
    return configs.find((c) => c.provider === 'openrouter' && c.model_id === '__global__') ?? null;
  }, [configs]);

  const getDecryptedKey = useCallback(async (configId: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('get_decrypted_model_key', { p_config_id: configId });
    if (error || !data) return null;
    return data as string;
  }, []);

  return { configs, loading, fetchConfigs, storeModelKey, deleteModelKey, setDefault, getDefault, getGlobalKey, getDecryptedKey };
}
