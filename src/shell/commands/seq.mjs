/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function seqCommand({ args, ok, fail }) {
  if (args.length < 1 || args.length > 3) {
    return { result: fail("seq: invalid arguments") };
  }

  const nums = args.map(Number);
  if (nums.some((value) => Number.isNaN(value))) {
    return { result: fail("seq: invalid arguments") };
  }

  let start = 1;
  let step = 1;
  let end = 1;

  if (nums.length === 1) {
    end = nums[0];
  } else if (nums.length === 2) {
    start = nums[0];
    end = nums[1];
  } else if (nums.length >= 3) {
    start = nums[0];
    step = nums[1];
    end = nums[2];
  }

  const out = [];
  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
    out.push(i);
  }

  if (out.length === 0) {
    return { result: ok("") };
  }

  return { result: ok(`${out.join("\n")}\n`) };
}
