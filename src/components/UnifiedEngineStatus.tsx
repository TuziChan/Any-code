import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Download, RefreshCw, Trash2, MoreHorizontal, Search, Wrench, AlertTriangle } from "lucide-react";
import { ClaudeIcon } from "@/components/icons/ClaudeIcon";
import { CodexIcon } from "@/components/icons/CodexIcon";
import { GeminiIcon } from "@/components/icons/GeminiIcon";
import { cn } from "@/lib/utils";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { api, type ToolSearchPatchStatus } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface UnifiedEngineStatusProps {
  className?: string;
  compact?: boolean;
}

type EngineType = 'claude' | 'codex' | 'gemini';
type ActionType = 'install' | 'update' | 'uninstall';

interface EngineStatusDisplay {
  type: EngineType;
  isInstalled: boolean;
  statusText: string;
  version?: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// Engine action API mapping
const ENGINE_ACTIONS: Record<EngineType, Record<ActionType, () => Promise<any>>> = {
  claude: {
    install: () => api.installClaudeCli(),
    update: () => api.updateClaudeCli(),
    uninstall: () => api.uninstallClaudeCli(),
  },
  codex: {
    install: () => api.installCodexCli(),
    update: () => api.updateCodexCli(),
    uninstall: () => api.uninstallCodexCli(),
  },
  gemini: {
    install: () => api.installGeminiCli(),
    update: () => api.updateGeminiCli(),
    uninstall: () => api.uninstallGeminiCli(),
  },
};

export const UnifiedEngineStatus: React.FC<UnifiedEngineStatusProps> = ({
  className,
  compact = false,
}) => {
  const {
    loading,
    claudeInstalled,
    claudeVersion,
    codexAvailable,
    codexVersion,
    geminiInstalled,
    geminiVersion,
    refresh,
  } = useEngineStatus();

  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: string; success: boolean; message: string } | null>(null);

  // ToolSearch patch state
  const [patchStatus, setPatchStatus] = useState<ToolSearchPatchStatus | null>(null);
  const [patchChecking, setPatchChecking] = useState(false);
  const [patchApplying, setPatchApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check ToolSearch patch status when Claude is installed
  useEffect(() => {
    if (claudeInstalled) {
      setPatchChecking(true);
      api.checkToolSearchPatch()
        .then(setPatchStatus)
        .catch(() => setPatchStatus(null))
        .finally(() => setPatchChecking(false));
    }
  }, [claudeInstalled, refreshKey]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    if (refresh) refresh();
    setRefreshKey((k) => k + 1);
    // 给引擎状态刷新一点时间
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleApplyPatch = async () => {
    setPatchApplying(true);
    try {
      const result = await api.applyToolSearchFix();
      setActionResult({
        type: 'toolsearch-fix',
        success: result.success,
        message: result.message,
      });
      // Re-check status
      const newStatus = await api.checkToolSearchPatch();
      setPatchStatus(newStatus);
    } catch (err) {
      setActionResult({
        type: 'toolsearch-fix',
        success: false,
        message: String(err),
      });
    } finally {
      setPatchApplying(false);
      setTimeout(() => setActionResult(null), 3000);
    }
  };

  const statuses: EngineStatusDisplay[] = [
    {
      type: 'claude',
      isInstalled: claudeInstalled,
      statusText: claudeInstalled ? '已安装' : '未检测到',
      version: claudeVersion,
      label: 'Claude Code',
      icon: ClaudeIcon,
      color: 'text-orange-500'
    },
    {
      type: 'codex',
      isInstalled: codexAvailable,
      statusText: codexAvailable ? '已配置' : '未配置',
      version: codexVersion,
      label: 'OpenAI Codex',
      icon: CodexIcon,
      color: 'text-blue-500'
    },
    {
      type: 'gemini',
      isInstalled: geminiInstalled,
      statusText: geminiInstalled ? '已安装' : '未安装',
      version: geminiVersion,
      label: 'Google Gemini',
      icon: GeminiIcon,
      color: 'text-purple-500'
    },
  ];

  const handleAction = async (engineType: EngineType, action: ActionType) => {
    const key = `${engineType}-${action}`;
    setActionInProgress(key);
    setActionResult(null);
    try {
      const result = await ENGINE_ACTIONS[engineType][action]();
      setActionResult({
        type: key,
        success: result.success,
        message: result.message,
      });
      // Refresh engine status after action
      if (refresh) refresh();
    } catch (err) {
      setActionResult({
        type: key,
        success: false,
        message: String(err),
      });
    } finally {
      setActionInProgress(null);
      // Auto-clear result after 3s
      setTimeout(() => setActionResult(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex justify-center py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      {compact ? (
        <div className="flex flex-col items-center gap-2">
          {statuses.map((engine) => (
            <TooltipProvider key={engine.type}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group cursor-default">
                    <engine.icon className={cn("h-5 w-5 transition-opacity", engine.isInstalled ? engine.color : "text-muted-foreground/40")} />
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                      engine.isInstalled ? "bg-green-500" : "bg-red-500"
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-2">
                  <div className="text-xs font-medium flex items-center gap-2">
                    <engine.icon className={cn("h-3.5 w-3.5", engine.color)} />
                    <span>{engine.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {engine.statusText} {engine.version && `(${engine.version})`}
                  </div>
                  {/* ToolSearch patch status in tooltip for Claude */}
                  {engine.type === 'claude' && patchStatus && patchStatus.status !== 'not_found' && (
                    <div className={cn(
                      "text-[10px] mt-1.5 pt-1.5 border-t border-border/50",
                      patchStatus.status === 'patched' ? "text-green-600 dark:text-green-400" :
                      patchStatus.status === 'unpatched' ? "text-amber-600 dark:text-amber-400" :
                      "text-muted-foreground"
                    )}>
                      {patchStatus.status === 'patched' ? '✓ ToolSearch 已修复' :
                       patchStatus.status === 'unpatched' ? '⚠ ToolSearch 受限' :
                       '? ToolSearch 状态未知'}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}

          {/* ToolSearch patch indicator for Claude (compact mode) */}
          {claudeInstalled && patchStatus && patchStatus.status === 'unpatched' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative cursor-default">
                    <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-2 max-w-[200px]">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    ToolSearch 受限
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    使用第三方代理时 ToolSearch 不可用。展开侧边栏查看修复选项。
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground/60", refreshing && "animate-spin")} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                刷新状态
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : (
        <div className="space-y-2 px-2">
          <div className="flex items-center justify-between mb-1 ml-1">
            <span className="text-xs font-medium text-muted-foreground">
              引擎状态
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className="p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    <RefreshCw className={cn("h-3 w-3 text-muted-foreground", refreshing && "animate-spin")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  刷新状态
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid gap-1.5">
            {statuses.map((engine) => {
              const isActing = actionInProgress?.startsWith(engine.type);
              return (
                <div
                  key={engine.type}
                  className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 rounded px-2 py-1.5 transition-colors border border-transparent hover:border-border/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <engine.icon className={cn("h-3.5 w-3.5 flex-shrink-0", engine.isInstalled ? engine.color : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <span className={cn("text-xs", !engine.isInstalled && "text-muted-foreground")}>{engine.label}</span>
                      {engine.version && (
                        <span className="text-[10px] text-muted-foreground ml-1">{engine.version}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isActing ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {engine.isInstalled ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="right" className="w-36">
                            {!engine.isInstalled ? (
                              <DropdownMenuItem
                                onClick={() => handleAction(engine.type, 'install')}
                                className="text-xs gap-2"
                              >
                                <Download className="h-3 w-3" />
                                安装
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleAction(engine.type, 'update')}
                                  className="text-xs gap-2"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  更新
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleAction(engine.type, 'uninstall')}
                                  className="text-xs gap-2 text-red-500 focus:text-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  卸载
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ToolSearch Patch Status (Claude only) */}
          {claudeInstalled && patchStatus && (
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-[11px] border",
              patchStatus.status === 'patched'
                ? "bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400"
                : patchStatus.status === 'unpatched'
                ? "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-muted/30 border-border/50 text-muted-foreground"
            )}>
              {patchStatus.status === 'patched' ? (
                <>
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1">ToolSearch 已修复</span>
                </>
              ) : patchStatus.status === 'unpatched' ? (
                <>
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1">ToolSearch 受限</span>
                  <button
                    onClick={handleApplyPatch}
                    disabled={patchApplying}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors text-[10px] font-medium"
                  >
                    {patchApplying ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Wrench className="h-2.5 w-2.5" />
                    )}
                    修复
                  </button>
                </>
              ) : patchStatus.status === 'not_found' ? (
                <>
                  <Search className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1">ToolSearch 未检测到</span>
                  <button
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-[10px] font-medium"
                  >
                    <RefreshCw className={cn("h-2.5 w-2.5", refreshing && "animate-spin")} />
                    重试
                  </button>
                </>
              ) : (
                <>
                  <Search className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1">ToolSearch 状态未知</span>
                </>
              )}
            </div>
          )}
          {claudeInstalled && patchChecking && (
            <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              检测 ToolSearch 状态...
            </div>
          )}

          {/* Action result toast */}
          {actionResult && (
            <div className={cn(
              "text-[10px] px-2 py-1 rounded",
              actionResult.success
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {actionResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
