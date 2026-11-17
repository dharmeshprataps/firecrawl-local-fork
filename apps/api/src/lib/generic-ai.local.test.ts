const state = vi.hoisted(() => ({
  config: {
    LOCAL_BOUNDED_INFERENCE: true,
    OLLAMA_BASE_URL: "http://host.lima.internal:11435/api" as
      | string
      | undefined,
    MODEL_NAME: "qwen2.5:3b" as string | undefined,
  },
  local: vi.fn((name: string) => ({ modelId: name, provider: "ollama" })),
  cloud: vi.fn((name: string) => ({ modelId: name, provider: "cloud" })),
  telemetry: vi.fn((model: unknown) => model),
}));
vi.mock("../config", () => ({ config: state.config }));
vi.mock("ollama-ai-provider-v2", () => ({ createOllama: () => state.local }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => Object.assign(state.cloud, { chat: state.cloud }),
}));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: state.cloud }));
vi.mock("@ai-sdk/groq", () => ({ groq: state.cloud }));
vi.mock("@ai-sdk/google", () => ({ google: state.cloud }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => state.cloud,
}));
vi.mock("@ai-sdk/fireworks", () => ({ fireworks: state.cloud }));
vi.mock("@ai-sdk/deepinfra", () => ({ deepinfra: state.cloud }));
vi.mock("@ai-sdk/google-vertex", () => ({ createVertex: () => state.cloud }));
vi.mock("ai", () => ({
  wrapLanguageModel: ({ model }: { model: unknown }) => model,
}));
vi.mock("./ai-usage-telemetry", () => ({
  withUsageTelemetry: state.telemetry,
}));
vi.mock("./anthropic-federation", () => ({
  createFederatedAnthropic: () => state.cloud,
}));
vi.mock("./openai-federation", () => ({
  createFederatedOpenAI: () => state.cloud,
}));
vi.mock("../scraper/scrapeURL/error", () => ({
  UsOnlyUnavailableError: class extends Error {},
}));
import { getModel } from "./generic-ai";

beforeEach(() => {
  vi.clearAllMocks();
  state.config.LOCAL_BOUNDED_INFERENCE = true;
  state.config.OLLAMA_BASE_URL = "http://host.lima.internal:11435/api";
  state.config.MODEL_NAME = "qwen2.5:3b";
});

describe("Opt-in bounded local provider routing", () => {
  it("keeps all explicit providers and retry models local when opted in", () => {
    for (const provider of [
      "openai",
      "ollama",
      "anthropic",
      "groq",
      "google",
      "openrouter",
      "fireworks",
      "deepinfra",
      "vertex",
    ] as const) {
      expect(
        getModel("gpt-4.1-mini", provider, { ignoreModelOverride: true }),
      ).toEqual({ modelId: "qwen2.5:3b", provider: "ollama" });
    }
    expect(state.local).toHaveBeenCalledTimes(9);
    expect(state.telemetry).toHaveBeenCalledTimes(9);
    expect(state.cloud).not.toHaveBeenCalled();
  });

  it("rejects missing or unreviewed configuration before choosing any provider", () => {
    state.config.MODEL_NAME = undefined;
    expect(() => getModel("gpt-4o", "openai")).toThrow("pinned");
    state.config.MODEL_NAME = "gpt-4o:cloud";
    expect(() => getModel("gpt-4o", "openai")).toThrow("pinned");
    state.config.MODEL_NAME = "qwen2.5:3b";
    state.config.OLLAMA_BASE_URL = undefined;
    expect(() => getModel("gpt-4o", "openai")).toThrow(
      "explicitly configured Ollama endpoint",
    );
    state.config.OLLAMA_BASE_URL = "https://ollama.com/api";
    expect(() => getModel("gpt-4o", "openai")).toThrow("reviewed");
    expect(state.cloud).not.toHaveBeenCalled();
    expect(state.local).not.toHaveBeenCalled();
  });

  it("does not bypass the upstream US-only restriction", () => {
    expect(() =>
      getModel("gpt-4o", "openai", { teamFlags: { usOnly: true } as any }),
    ).toThrow("US-only processing");
    expect(state.cloud).not.toHaveBeenCalled();
    expect(state.local).not.toHaveBeenCalled();
  });

  it("preserves ordinary native Ollama settings when the bounded profile is off", () => {
    state.config.LOCAL_BOUNDED_INFERENCE = false;
    state.config.OLLAMA_BASE_URL = "http://localhost:11434/api";
    state.config.MODEL_NAME = "llama3.2";
    expect(getModel("requested-model", "ollama")).toEqual({
      modelId: "llama3.2",
      provider: "ollama",
    });
    expect(
      getModel("requested-model", "ollama", { ignoreModelOverride: true }),
    ).toEqual({ modelId: "requested-model", provider: "ollama" });
    expect(state.telemetry).toHaveBeenCalledTimes(2);
    expect(state.cloud).not.toHaveBeenCalled();
  });

  it("preserves explicit cloud selection and model override options when off", () => {
    state.config.LOCAL_BOUNDED_INFERENCE = false;
    state.config.OLLAMA_BASE_URL = undefined;
    state.config.MODEL_NAME = "operator-override";
    expect(getModel("gpt-4o", "openai")).toEqual({
      modelId: "operator-override",
      provider: "cloud",
    });
    expect(getModel("gpt-4o", "openai", { ignoreModelOverride: true })).toEqual(
      { modelId: "gpt-4o", provider: "cloud" },
    );
    expect(state.telemetry).toHaveBeenCalledTimes(2);
    expect(state.local).not.toHaveBeenCalled();
  });

  it("retains the upstream refusal when no US-only endpoint is configured", () => {
    state.config.LOCAL_BOUNDED_INFERENCE = false;
    state.config.OLLAMA_BASE_URL = undefined;
    state.config.MODEL_NAME = undefined;
    expect(() =>
      getModel("gpt-4o", "openai", { teamFlags: { usOnly: true } as any }),
    ).toThrow("US-only processing");
    expect(state.local).not.toHaveBeenCalled();
    expect(state.cloud).not.toHaveBeenCalled();
  });
});
