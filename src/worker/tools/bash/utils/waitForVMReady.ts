import { isVMReady } from "../../../../shell/vm.js";
import { VM_READY_POLL_MS } from "./types.js";

export async function waitForVMReady(timeoutMs: number): Promise<boolean> {
  if (isVMReady()) {
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, VM_READY_POLL_MS);
    });

    if (isVMReady()) {
      return true;
    }
  }

  return isVMReady();
}
