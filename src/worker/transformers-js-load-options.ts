function parseModelBillionsFromId(modelId: string): number | null {
  const match = /(?:^|[-_\/.])(\d+(?:\.\d+)?)b(?:[-_\/.]|$)/i.exec(modelId);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export type BrowserDtype = "q4f16" | "q4" | "fp16" | "q8" | "fp32";
export type DtypeStrategy = "auto" | "memory" | "balanced" | "quality";

export function normalizeDtypeStrategy(value: unknown): DtypeStrategy {
  if (value === "memory") {
    return "memory";
  }

  if (value === "balanced") {
    return "balanced";
  }

  if (value === "quality") {
    return "quality";
  }

  return "auto";
}

function uniqueStable(items: BrowserDtype[]): BrowserDtype[] {
  const seen = new Set<BrowserDtype>();
  const out: BrowserDtype[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }

  return out;
}

export function getPreferredDtypes(
  device: string,
  modelId: string,
  deviceMemoryGb: number | null,
  strategy: DtypeStrategy = "auto",
): BrowserDtype[] {
  const isWebGpu = device === "webgpu";
  const isWebNn = device.startsWith("webnn");

  if (isWebGpu || isWebNn) {
    // WebGPU/WebNN can choose between memory-first and quality-first paths.
    if (strategy === "quality") {
      return ["fp16", "q4f16", "q4"];
    }

    if (strategy === "balanced") {
      return ["q4f16", "fp16", "q4"];
    }

    return ["q4f16", "q4", "fp16"];
  }

  // CPU/wasm path.
  if (strategy === "quality") {
    return ["fp32", "fp16", "q8", "q4"];
  }

  if (strategy === "balanced") {
    return ["q8", "fp16", "q4", "fp32"];
  }

  if (strategy === "memory") {
    return ["q4", "q8", "fp16"];
  }

  const dtypes: BrowserDtype[] = ["q8", "q4", "fp16"];
  const modelBillions = parseModelBillionsFromId(modelId);

  // Only allow fp32 fallback for very small models on high-memory devices.
  const allowFp32Fallback =
    modelBillions !== null &&
    modelBillions <= 0.6 &&
    typeof deviceMemoryGb === "number" &&
    deviceMemoryGb >= 16;

  if (allowFp32Fallback) {
    dtypes.push("fp32");
  }

  return uniqueStable(dtypes);
}
