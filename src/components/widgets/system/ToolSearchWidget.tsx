/**
 * ToolSearch Widget - 工具搜索结果展示
 *
 * 用于展示 ToolSearch 工具的搜索查询和返回的工具定义
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Package, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolSearchWidgetProps {
  /** 搜索查询 */
  query: string;
  /** 最大结果数 */
  maxResults?: number;
  /** 工具结果 */
  result?: any;
}

/**
 * 从结果中解析工具定义列表
 */
function parseToolDefinitions(result: any): Array<{ name: string; description: string; parameters?: any }> {
  if (!result) return [];

  let content = result.content;
  if (!content) return [];

  // 如果是字符串，尝试提取 <functions> 块中的工具定义
  if (typeof content === 'string') {
    const tools: Array<{ name: string; description: string; parameters?: any }> = [];

    // 匹配 JSON 格式的 function 定义
    const funcRegex = /<function>\s*(\{[\s\S]*?\})\s*<\/function>/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        tools.push({
          name: parsed.name || 'unknown',
          description: parsed.description || '',
          parameters: parsed.parameters,
        });
      } catch {
        // 解析失败，跳过
      }
    }

    if (tools.length > 0) return tools;

    // 尝试直接作为 JSON 解析
    try {
      const parsed = JSON.parse(content);
      if (parsed.tool_name) {
        return [{ name: parsed.tool_name, description: parsed.description || '' }];
      }
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) => ({
          name: t.name || t.tool_name || 'unknown',
          description: t.description || '',
          parameters: t.parameters,
        }));
      }
    } catch {
      // 不是 JSON
    }
  }

  // 如果是对象
  if (typeof content === 'object') {
    if (content.tool_name) {
      return [{ name: content.tool_name, description: content.description || '' }];
    }
    if (Array.isArray(content)) {
      return content.map((t: any) => ({
        name: t.name || t.tool_name || 'unknown',
        description: t.description || '',
        parameters: t.parameters,
      }));
    }
  }

  return [];
}

export const ToolSearchWidget: React.FC<ToolSearchWidgetProps> = ({ query, maxResults, result }) => {
  const { t } = useTranslation();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const tools = parseToolDefinitions(result);
  const isError = result?.is_error;
  const hasResult = !!result;

  return (
    <div className="space-y-2 w-full">
      {/* 头部 */}
      <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-md border border-border/50">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0 text-sm">
              <span className="text-sm font-medium text-muted-foreground">ToolSearch</span>
              <span className="text-muted-foreground/30">|</span>
              <code className="font-mono text-foreground/90 font-medium truncate" title={query}>
                {query}
              </code>
              {maxResults && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="text-xs text-muted-foreground">max: {maxResults}</span>
                </>
              )}
            </div>
          </div>

          {!hasResult && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-pulse" />
              <span>{t('widget.searching', '搜索中...')}</span>
            </div>
          )}

          {hasResult && !isError && (
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <span className="text-green-600 dark:text-green-400 font-medium">
                {tools.length > 0
                  ? t('widget.foundTools', { count: tools.length, defaultValue: `找到 ${tools.length} 个工具` })
                  : t('widget.toolLoaded', '工具已加载')}
              </span>
            </div>
          )}

          {hasResult && isError && (
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <span className="text-red-600 dark:text-red-400 font-medium">
                {t('widget.searchFailed', '搜索失败')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 工具列表 */}
      {hasResult && tools.length > 0 && (
        <div className="rounded-lg border overflow-hidden bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className={cn(
                "border-b border-zinc-200 dark:border-zinc-800 last:border-b-0",
              )}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
              >
                <Package className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                <span className="font-mono text-sm font-medium text-foreground/90">{tool.name}</span>
                {tool.description && (
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {tool.description.length > 80 ? tool.description.slice(0, 80) + '...' : tool.description}
                  </span>
                )}
                {tool.parameters && (
                  <div className="flex-shrink-0">
                    {expandedTool === tool.name ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* 展开的参数详情 */}
              {expandedTool === tool.name && tool.parameters && (
                <div className="px-3 pb-2">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto bg-muted/20 rounded p-2">
                    {JSON.stringify(tool.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
