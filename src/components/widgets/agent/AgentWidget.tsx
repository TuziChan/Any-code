/**
 * AgentWidget - Agent/子代理工具专用渲染器
 *
 * 用于渲染 Claude Code 的 Agent 工具调用
 * 支持显示 subagent_type、description、prompt 等字段
 * 替代原始 JSON 降级渲染
 */

import React, { useState, useMemo } from 'react';
import {
  Bot, Sparkles, Zap, ChevronRight, Search, Map, Wrench,
  CheckCircle, Loader2, AlertCircle, Copy, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export interface AgentWidgetProps {
  /** 子代理类型 */
  subagentType?: string;
  /** 任务简述 */
  description?: string;
  /** 完整 prompt */
  prompt?: string;
  /** 模型覆盖 */
  model?: string;
  /** 是否后台运行 */
  runInBackground?: boolean;
  /** 隔离模式 */
  isolation?: string;
  /** 工具结果 */
  result?: {
    content?: any;
    is_error?: boolean;
  };
  /** 是否正在流式输出 */
  isStreaming?: boolean;
}

/** 子代理类型配置 */
const AGENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  'Explore': { label: '探索代理', icon: Search, color: 'emerald' },
  'Plan': { label: '规划代理', icon: Map, color: 'violet' },
  'general-purpose': { label: '通用代理', icon: Bot, color: 'blue' },
  'statusline-setup': { label: '状态栏配置', icon: Wrench, color: 'amber' },
  'code-reviewer': { label: '代码审查', icon: Search, color: 'orange' },
};

function getAgentConfig(type?: string) {
  if (!type) return { label: '子代理', icon: Bot, color: 'blue' };
  return AGENT_TYPE_CONFIG[type] ?? { label: type, icon: Bot, color: 'blue' };
}

function colorClass(color: string, variant: 'text' | 'bg' | 'border') {
  const map: Record<string, Record<string, string>> = {
    blue:    { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    emerald: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    violet:  { text: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    amber:   { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    orange:  { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  };
  return map[color]?.[variant] ?? map.blue[variant];
}

/** 解析结果内容 */
function parseResultContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'string' ? item : item?.text ?? JSON.stringify(item)))
      .join('\n');
  }
  try { return JSON.stringify(content, null, 2); } catch { return String(content); }
}

export const AgentWidget: React.FC<AgentWidgetProps> = ({
  subagentType,
  description,
  prompt,
  model,
  runInBackground,
  isolation,
  result,
  isStreaming,
}) => {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = useMemo(() => getAgentConfig(subagentType), [subagentType]);
  const AgentIcon = config.icon;
  const c = config.color;

  const hasResult = result !== undefined;
  const isError = result?.is_error === true;
  const resultText = useMemo(() => parseResultContent(result?.content), [result?.content]);
  const isLongResult = resultText.length > 600;

  const handleCopyPrompt = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('rounded-lg border overflow-hidden bg-card', colorClass(c, 'border'))}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50">
        <div className="relative flex-shrink-0">
          <AgentIcon className={cn('h-4 w-4', colorClass(c, 'text'))} />
          <Sparkles className={cn('h-2.5 w-2.5 absolute -top-1 -right-1', colorClass(c, 'text'))} />
        </div>
        <span className="text-sm font-medium">
          {config.label}
        </span>
        {model && (
          <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded font-mono text-muted-foreground">
            {model}
          </code>
        )}
        {runInBackground && (
          <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">后台</span>
        )}
        {isolation && (
          <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">{isolation}</span>
        )}
        <div className="flex-1" />
        {/* Status */}
        {isStreaming ? (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" /> 执行中
          </span>
        ) : hasResult ? (
          isError ? (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> 失败
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle className="h-3 w-3" /> 完成
            </span>
          )
        ) : null}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Description */}
        {description && (
          <div className={cn('rounded-md border p-2.5', colorClass(c, 'border'), 'bg-background/50')}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className={cn('h-3 w-3', colorClass(c, 'text'))} />
              <span className={cn('text-xs font-medium', colorClass(c, 'text'))}>任务</span>
            </div>
            <p className="text-sm text-foreground ml-4.5">{description}</p>
          </div>
        )}

        {/* Prompt (collapsible) */}
        {prompt && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={cn('h-3 w-3 transition-transform', promptExpanded && 'rotate-90')} />
                详细指令
              </button>
              <button
                onClick={handleCopyPrompt}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="复制指令"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            {promptExpanded && (
              <div className="rounded-md border bg-muted/30 p-3 max-h-[300px] overflow-auto">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{prompt}</pre>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {hasResult && resultText && (
          <div className="space-y-1.5">
            <button
              onClick={() => setResultExpanded(!resultExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={cn('h-3 w-3 transition-transform', resultExpanded && 'rotate-90')} />
              执行结果 {isLongResult && !resultExpanded && `(${resultText.length} 字符)`}
            </button>
            {resultExpanded && (
              <div className={cn(
                'rounded-md border p-3 max-h-[400px] overflow-auto',
                isError ? 'border-red-500/20 bg-red-500/5' : 'bg-muted/30'
              )}>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                  <ReactMarkdown>{resultText}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && !hasResult && !description && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>正在启动代理...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentWidget;
