import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export function useAutoSave(agentId: string, onSave?: (updatedAgent: any) => void) {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedDataRef = useRef<any>({});

  const saveField = useCallback(async (field: string, value: any) => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 检查值是否真的改变了
    if (lastSavedDataRef.current[field] === value) {
      return;
    }

    // 设置新的定时器进行保存
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`Auto-saving ${field}:`, value);

        const updateData = { [field]: value };
        const response = await api.put(`/api/agents/${agentId}`, updateData);

        // 更新最后保存的值
        lastSavedDataRef.current[field] = value;

        // 调用回调函数
        if (onSave) {
          onSave(response.data);
        }

        console.log(`${field} saved successfully`);
      } catch (error) {
        console.error(`Failed to save ${field}:`, error);
      }
    }, 300); // 300ms延迟保存
  }, [agentId, onSave]);

  const saveMultiSelectField = useCallback((field: string, selectedValues: string[]) => {
    const value = selectedValues.join(',');
    saveField(field, value);
  }, [saveField]);

  // 初始化最后保存的数据
  const initializeSavedData = useCallback((agent: any) => {
    lastSavedDataRef.current = {
      name: agent.name,
      description: agent.description || '',
      language: agent.language,
      tone: agent.tone,
      customPrompt: agent.customPrompt || '',
    };
  }, []);

  return {
    saveField,
    saveMultiSelectField,
    initializeSavedData,
  };
}