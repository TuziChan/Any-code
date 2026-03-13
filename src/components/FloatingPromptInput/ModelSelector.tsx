import React, { useState, useEffect } from "react";
import { ChevronUp, Check, Star, Globe, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ModelType, ModelConfig } from "./types";
import { MODELS } from "./constants";
import { getDefaultModel, setDefaultModel } from "./defaultModelStorage";
import { api, type ProviderConfig, type CurrentProviderConfig } from "@/lib/api";

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
  availableModels?: ModelConfig[];
}

/**
 * ModelSelector component - Dropdown for selecting AI model
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
  availableModels = MODELS
}) => {
  const [open, setOpen] = React.useState(false);
  const [currentDefaultModel, setCurrentDefaultModel] = React.useState<ModelType | null>(() => getDefaultModel());
  const selectedModelData = availableModels.find(m => m.id === selectedModel) || availableModels[0];

  // Provider (代理商) quick switch state
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [currentProvider, setCurrentProvider] = useState<CurrentProviderConfig | null>(null);
  const [switchingProvider, setSwitchingProvider] = useState<string | null>(null);
  const [providersLoaded, setProvidersLoaded] = useState(false);

  // Load providers when popover opens
  useEffect(() => {
    if (open && !providersLoaded) {
      loadProviders();
    }
  }, [open]);

  const loadProviders = async () => {
    try {
      const [presets, config] = await Promise.all([
        api.getProviderPresets(),
        api.getCurrentProviderConfig(),
      ]);
      setProviders(presets);
      setCurrentProvider(config);
      setProvidersLoaded(true);
    } catch (err) {
      console.error('[ModelSelector] Failed to load providers:', err);
    }
  };

  const handleSwitchProvider = async (e: React.MouseEvent, provider: ProviderConfig) => {
    e.stopPropagation();
    try {
      setSwitchingProvider(provider.id);
      await api.switchProviderConfig(provider);
      const config = await api.getCurrentProviderConfig();
      setCurrentProvider(config);
    } catch (err) {
      console.error('[ModelSelector] Failed to switch provider:', err);
    } finally {
      setSwitchingProvider(null);
    }
  };

  const handleClearProvider = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSwitchingProvider('clear');
      await api.clearProviderConfig();
      const config = await api.getCurrentProviderConfig();
      setCurrentProvider(config);
    } catch (err) {
      console.error('[ModelSelector] Failed to clear provider:', err);
    } finally {
      setSwitchingProvider(null);
    }
  };

  // Check if a provider is currently active
  const isProviderActive = (provider: ProviderConfig) => {
    if (!currentProvider) return false;
    return currentProvider.anthropic_base_url === provider.base_url;
  };

  const hasActiveProvider = currentProvider?.anthropic_base_url && providers.some(p => isProviderActive(p));

  // Handle setting default model
  const handleSetDefault = (e: React.MouseEvent, modelId: ModelType) => {
    e.stopPropagation();
    setDefaultModel(modelId);
    setCurrentDefaultModel(modelId);
  };

  return (
    <Popover
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-2 min-w-[160px] justify-start border-border/50 bg-background/50 hover:bg-accent/50"
        >
          {selectedModelData.icon}
          <span className="flex-1 text-left">{selectedModelData.name}</span>
          {currentDefaultModel === selectedModel && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          )}
          <ChevronUp className="h-4 w-4 opacity-50" />
        </Button>
      }
      content={
        <div className="w-[320px] p-1">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/50 mb-1">
            选择模型（点击星标设为新会话默认）
          </div>
          {availableModels.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left group",
                "hover:bg-accent",
                selectedModel === model.id && "bg-accent"
              )}
            >
              <div className="mt-0.5">{model.icon}</div>
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  {model.name}
                  {selectedModel === model.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {model.description}
                </div>
              </div>
              <button
                onClick={(e) => handleSetDefault(e, model.id)}
                className={cn(
                  "mt-0.5 p-1 rounded hover:bg-muted transition-colors",
                  currentDefaultModel === model.id
                    ? "text-yellow-500"
                    : "text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
                )}
                title={currentDefaultModel === model.id ? "当前默认模型" : "设为默认模型"}
              >
                <Star className={cn(
                  "h-4 w-4",
                  currentDefaultModel === model.id && "fill-yellow-500"
                )} />
              </button>
            </button>
          ))}

          {/* Quick Provider (代理商) Switch */}
          {providers.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/50 mt-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  快速切换代理商
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent('open-provider-settings'));
                  }}
                  className="text-muted-foreground/60 hover:text-foreground transition-colors"
                  title="管理代理商"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </div>

              {/* Official (no provider) option */}
              <button
                onClick={(e) => {
                  if (hasActiveProvider) handleClearProvider(e);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-left text-sm",
                  "hover:bg-accent",
                  !hasActiveProvider && "bg-accent/60"
                )}
              >
                <div className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  !hasActiveProvider ? "bg-green-500" : "bg-muted-foreground/30"
                )} />
                <span className={cn(
                  "flex-1 truncate",
                  !hasActiveProvider ? "font-medium" : "text-muted-foreground"
                )}>
                  官方 API
                </span>
                {switchingProvider === 'clear' && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                {!hasActiveProvider && !switchingProvider && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>

              {providers.map((provider) => {
                const active = isProviderActive(provider);
                const switching = switchingProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    onClick={(e) => {
                      if (!active) handleSwitchProvider(e, provider);
                    }}
                    disabled={switching}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-left text-sm",
                      "hover:bg-accent",
                      active && "bg-accent/60"
                    )}
                  >
                    <div className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      active ? "bg-green-500" : "bg-muted-foreground/30"
                    )} />
                    <span className={cn(
                      "flex-1 truncate",
                      active ? "font-medium" : "text-muted-foreground"
                    )}>
                      {provider.name}
                    </span>
                    {switching && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {active && !switching && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      align="start"
      side="top"
    />
  );
};
