'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AIConfig, ConversationMessage } from '@/types/ai';
import { AI_STORAGE_KEYS, DEFAULT_AI_CONFIG, MAX_HISTORY_MESSAGES } from '@/types/ai';
import { createPageAgent, PageAgentWrapper } from '@/lib/pageAgent';

interface AIContextType {
  /** AI 配置（仅保存非敏感 UI 配置；LLM Key 由 Squid 代理管理） */
  config: AIConfig;
  /** 更新 AI 配置 */
  setConfig: (config: Partial<AIConfig>) => void;
  /** 配置是否满足启用条件 */
  isConfigured: boolean;
  /** AI 助手是否启用 */
  isEnabled: boolean;
  /** 当前页面内存中的对话历史，不持久化患者/样本信息 */
  history: ConversationMessage[];
  /** 添加一条对话消息 */
  addMessage: (message: ConversationMessage) => void;
  /** 清空对话历史 */
  clearHistory: () => void;
  /** 执行自然语言命令 */
  executeCommand: (command: string) => Promise<void>;
  /** 是否正在执行命令 */
  isExecuting: boolean;
  /** page-agent 包装实例 */
  agent: PageAgentWrapper | null;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStoredConfig(value: unknown): AIConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_AI_CONFIG;
  }

  const raw = value as Partial<AIConfig>;
  const model = typeof raw.openaiModel === 'string' ? raw.openaiModel.trim() : '';
  return {
    openaiModel: model && model !== 'gpt-4'
      ? model
      : DEFAULT_AI_CONFIG.openaiModel,
    aiAssistantEnabled: typeof raw.aiAssistantEnabled === 'boolean'
      ? raw.aiAssistantEnabled
      : DEFAULT_AI_CONFIG.aiAssistantEnabled,
  };
}

function clearLegacyAIHistory() {
  try {
    localStorage.removeItem(AI_STORAGE_KEYS.HISTORY);
  } catch {
    // localStorage may be unavailable in strict privacy modes.
  }
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const agentRef = useRef<PageAgentWrapper | null>(null);

  const isConfigured = Boolean(config.openaiModel);
  const isEnabled = config.aiAssistantEnabled && isConfigured;

  // 只从 localStorage 读取非敏感 AI UI 配置；历史可能包含患者/样本信息，启动时清理旧缓存。
  useEffect(() => {
    try {
      const storedConfig = localStorage.getItem(AI_STORAGE_KEYS.CONFIG);
      if (storedConfig) {
        setConfigState(normalizeStoredConfig(JSON.parse(storedConfig)));
      }
    } catch (error) {
      console.error('Failed to load stored AI config:', error);
    } finally {
      clearLegacyAIHistory();
    }
  }, []);

  // 仅持久化非敏感配置，不持久化对话历史。
  useEffect(() => {
    try {
      localStorage.setItem(AI_STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  }, [config]);

  useEffect(() => {
    agentRef.current = isEnabled ? createPageAgent(config) : null;
  }, [config, isEnabled]);

  const setConfig = useCallback((partialConfig: Partial<AIConfig>) => {
    setConfigState(prev => normalizeStoredConfig({ ...prev, ...partialConfig }));
  }, []);

  const addMessage = useCallback((message: ConversationMessage) => {
    setHistory(prev => [...prev, message].slice(-MAX_HISTORY_MESSAGES));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    clearLegacyAIHistory();
  }, []);

  const executeCommand = useCallback(async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand || !agentRef.current || isExecuting) {
      return;
    }

    const userMessage: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: trimmedCommand,
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    const assistantMessage: ConversationMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'executing',
    };
    addMessage(assistantMessage);

    setIsExecuting(true);
    try {
      const result = await agentRef.current.execute(trimmedCommand);
      setHistory(prev => prev.map(msg => (
        msg.id === assistantMessage.id
          ? {
              ...msg,
              content: result.success ? `已执行：${trimmedCommand}` : `执行失败：${result.error}`,
              status: result.success ? 'completed' : 'error',
              actionResult: result.result,
            }
          : msg
      )));
    } catch (error) {
      setHistory(prev => prev.map(msg => (
        msg.id === assistantMessage.id
          ? {
              ...msg,
              content: `执行出错：${error instanceof Error ? error.message : '未知错误'}`,
              status: 'error',
            }
          : msg
      )));
    } finally {
      setIsExecuting(false);
    }
  }, [addMessage, isExecuting]);

  const value: AIContextType = {
    config,
    setConfig,
    isConfigured,
    isEnabled,
    history,
    addMessage,
    clearHistory,
    executeCommand,
    isExecuting,
    agent: agentRef.current,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
