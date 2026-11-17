const state = vi.hoisted(() => ({
  config: {
    LOCAL_BOUNDED_INFERENCE: false,
    OLLAMA_BASE_URL: "http://host.lima.internal:11435/api" as
      | string
      | undefined,
    MODEL_NAME: "qwen2.5:3b" as string | undefined,
  },
  contextZdr: false,
  local: vi.fn(),
  cloudText: vi.fn(),
  cloudObject: vi.fn(),
  telemetry: vi.fn((options: unknown) => options),
  addCost: vi.fn(),
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../config", () => ({ config: state.config }));
vi.mock("../../../lib/generic-ai", () => ({
  getModel: () => ({ modelId: "gpt-4o-mini" }),
}));
vi.mock("../../../lib/local-inference", async importOriginal => ({
  ...(await importOriginal<typeof import("../../../lib/local-inference")>()),
  generateLocalInference: state.local,
}));
vi.mock("../../../lib/logger", () => ({ logger: state.log }));
vi.mock("../../../lib/extract/usage/model-prices", () => ({ modelPrices: {} }));
vi.mock("../../../lib/cost-tracking", () => ({ CostTracking: class {} }));
vi.mock("../../../lib/otel-tracer", () => ({
  isZeroDataRetentionActive: () => state.contextZdr,
}));
vi.mock("../../../lib/ai-telemetry", () => ({ aiTelemetry: state.telemetry }));
vi.mock("../../../controllers/v1/types", () => ({
  isAgentExtractModelValid: () => true,
}));
vi.mock("../lib/extractSmartScrape", () => ({ extractData: vi.fn() }));
vi.mock("../error", () => ({ UsOnlyUnavailableError: class extends Error {} }));
vi.mock("@dqbd/tiktoken", () => ({ encoding_for_model: vi.fn() }));
vi.mock("ai", () => ({
  AISDKError: class extends Error {},
  NoObjectGeneratedError: class extends Error {},
  generateText: state.cloudText,
  generateObject: state.cloudObject,
  jsonSchema: (schema: unknown) => schema,
}));

import { generateCompletions } from "./llmExtract";
import { LocalInferenceError } from "../../../lib/local-inference";

const options = () => ({
  logger: state.log,
  options: { prompt: "Summarize the source" },
  markdown: "The source value is 42.",
  isExtractEndpoint: false,
  mode: "no-object" as const,
  model: { modelId: "gpt-4o-mini" },
  retryModel: { modelId: "gpt-4.1-mini" },
  costTrackingOptions: {
    costTracking: { addCall: state.addCost },
    metadata: {},
  },
  metadata: { teamId: "unit-team" },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.contextZdr = false;
  state.config.LOCAL_BOUNDED_INFERENCE = false;
  state.config.OLLAMA_BASE_URL = "http://host.lima.internal:11435/api";
  state.config.MODEL_NAME = "qwen2.5:3b";
  state.cloudText.mockResolvedValue({
    text: "The value is 42.",
    usage: { inputTokens: 10, outputTokens: 5 },
  });
  state.local.mockResolvedValue({
    extract: "The local value is 42.",
    numTokens: 0,
    warning: undefined,
    totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    model: "qwen2.5:3b",
  });
});

describe("Extraction routing preserves upstream behavior unless explicitly opted in", () => {
  it("uses the upstream SDK path with ordinary Ollama configuration when the flag is off", async () => {
    state.config.OLLAMA_BASE_URL = "http://localhost:11434/api";
    state.config.MODEL_NAME = "llama3.2";
    const result = await generateCompletions(options() as any);
    expect(result.extract).toBe("The value is 42.");
    expect(state.cloudText).toHaveBeenCalledTimes(1);
    expect(state.telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ isEnabled: true }),
    );
    expect(state.local).not.toHaveBeenCalled();
  });

  it("uses only the bounded provider after explicit opt-in", async () => {
    state.config.LOCAL_BOUNDED_INFERENCE = true;
    const result = await generateCompletions({
      ...options(),
      zeroDataRetention: true,
    } as any);
    expect(result.extract).toBe("The local value is 42.");
    expect(state.local).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://host.lima.internal:11435/api",
        modelName: "qwen2.5:3b",
        markdown: "The source value is 42.",
        mode: "no-object",
      }),
    );
    expect(state.cloudText).not.toHaveBeenCalled();
    expect(state.cloudObject).not.toHaveBeenCalled();
    expect(state.telemetry).not.toHaveBeenCalled();
    expect(state.addCost).toHaveBeenCalledWith(
      expect.objectContaining({ cost: 0, model: "qwen2.5:3b" }),
    );
  });

  it("fails closed on a missing provider and never enters SDK retries", async () => {
    state.config.LOCAL_BOUNDED_INFERENCE = true;
    state.config.OLLAMA_BASE_URL = undefined;
    await expect(generateCompletions(options() as any)).rejects.toMatchObject({
      code: "LOCAL_INFERENCE_UNAVAILABLE",
    });
    expect(state.local).not.toHaveBeenCalled();
    expect(state.cloudText).not.toHaveBeenCalled();
  });

  it("propagates local rate-limit failures without invoking a cloud retry model", async () => {
    state.config.LOCAL_BOUNDED_INFERENCE = true;
    state.local.mockRejectedValue(
      new LocalInferenceError("Local provider rate limit"),
    );
    await expect(generateCompletions(options() as any)).rejects.toMatchObject({
      code: "LOCAL_INFERENCE_UNAVAILABLE",
    });
    expect(state.local).toHaveBeenCalledTimes(1);
    expect(state.cloudText).not.toHaveBeenCalled();
    expect(state.cloudObject).not.toHaveBeenCalled();
  });

  it("rejects US-only requests even when callers supply prebuilt models", async () => {
    state.config.LOCAL_BOUNDED_INFERENCE = true;
    await expect(
      generateCompletions({ ...options(), teamFlags: { usOnly: true } } as any),
    ).rejects.toThrow("US-only processing");
    expect(state.local).not.toHaveBeenCalled();
    expect(state.cloudText).not.toHaveBeenCalled();
  });

  it.each(["request", "context"])(
    "preserves upstream %s ZDR telemetry suppression",
    async origin => {
      state.contextZdr = origin === "context";
      await generateCompletions({
        ...options(),
        zeroDataRetention: origin === "request",
      } as any);
      expect(state.cloudText).toHaveBeenCalledTimes(1);
      expect(state.telemetry).toHaveBeenCalledWith(
        expect.objectContaining({ isEnabled: false }),
      );
      expect(state.local).not.toHaveBeenCalled();
    },
  );
});
