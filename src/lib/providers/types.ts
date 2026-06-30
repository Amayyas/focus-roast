import type { ProviderConfig, ProviderId, TabInfo } from "../../types";
import type { FocusResponse } from "./shared";

/** A pluggable AI backend that turns open tabs into a focus analysis. */
export interface AiProvider {
  id: ProviderId;
  /** Human-readable name shown in the setup UI. */
  label: string;
  analyze(tabs: TabInfo[], config: ProviderConfig): Promise<FocusResponse>;
}
