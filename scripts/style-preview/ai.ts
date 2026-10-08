export const useAI = () => ({ isEnabled: false, isConfigured: false, config: { aiAssistantEnabled: false }, setConfig: () => { throw new Error('预览不保存助手设置'); } });
