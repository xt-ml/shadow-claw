import { globalFunctionRegistry } from "./FunctionRegistry.js";

import { resolveDynamicBoolean } from "../utils/resolveDynamicBoolean.js";
import { resolveDynamicNumber } from "../utils/resolveDynamicNumber.js";
import { resolveDynamicString } from "../utils/resolveDynamicString.js";
import { resolveJsonPointer } from "../utils/resolveJsonPointer.js";

export function registerBasicFunctions(): void {
  globalFunctionRegistry.register({
    name: "capitalize",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const inner = resolveDynamicString(args.value, context.dataModel);
      return inner.charAt(0).toUpperCase() + inner.slice(1);
    },
  });

  globalFunctionRegistry.register({
    name: "formatString",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const template = resolveDynamicString(args.value, context.dataModel);
      return template.replace(/\$\{([^}]+)\}/g, (_, pointer) =>
        String(resolveJsonPointer(context.dataModel, pointer) ?? ""),
      );
    },
  });

  globalFunctionRegistry.register({
    name: "formatNumber",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const num = resolveDynamicNumber(args.value, context.dataModel);
      const decimals =
        args.decimals !== undefined
          ? Number(resolveDynamicNumber(args.decimals, context.dataModel))
          : undefined;
      const grouping =
        args.grouping !== undefined
          ? resolveDynamicBoolean(args.grouping, context.dataModel)
          : true;
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouping,
      });
    },
  });

  globalFunctionRegistry.register({
    name: "formatCurrency",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const num = resolveDynamicNumber(args.value, context.dataModel);
      const currency = resolveDynamicString(args.currency, context.dataModel);
      const decimals =
        args.decimals !== undefined
          ? Number(resolveDynamicNumber(args.decimals, context.dataModel))
          : 2;
      return num.toLocaleString(undefined, {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
  });

  globalFunctionRegistry.register({
    name: "formatDate",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const dateStr = resolveDynamicString(args.value, context.dataModel);
      try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
      } catch {
        return dateStr;
      }
    },
  });

  globalFunctionRegistry.register({
    name: "pluralize",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const count = resolveDynamicNumber(args.value, context.dataModel);
      const one = resolveDynamicString(args.one, context.dataModel);
      const other = resolveDynamicString(args.other, context.dataModel);
      return count === 1 ? one : other;
    },
  });

  globalFunctionRegistry.register({
    name: "openUrl",
    callableFrom: "rendererOrAgent",
    evaluate: () => {
      return "";
    },
  });

  globalFunctionRegistry.register({
    name: "and",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      return args.values.every((v: any) =>
        resolveDynamicBoolean(v, context.dataModel),
      );
    },
  });

  globalFunctionRegistry.register({
    name: "or",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      return args.values.some((v: any) =>
        resolveDynamicBoolean(v, context.dataModel),
      );
    },
  });

  globalFunctionRegistry.register({
    name: "not",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      return !resolveDynamicBoolean(args.value, context.dataModel);
    },
  });

  globalFunctionRegistry.register({
    name: "required",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const v = resolveDynamicString(args.value, context.dataModel);
      return v.trim().length > 0;
    },
  });

  globalFunctionRegistry.register({
    name: "email",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const v = resolveDynamicString(args.value, context.dataModel);
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    },
  });

  globalFunctionRegistry.register({
    name: "regex",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const v = resolveDynamicString(args.value, context.dataModel);
      const pattern = resolveDynamicString(args.pattern, context.dataModel);
      return new RegExp(pattern).test(v);
    },
  });

  globalFunctionRegistry.register({
    name: "length",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const v = resolveDynamicString(args.value, context.dataModel);
      const min =
        args.min !== undefined
          ? resolveDynamicNumber(args.min, context.dataModel)
          : 0;
      const max =
        args.max !== undefined
          ? resolveDynamicNumber(args.max, context.dataModel)
          : Infinity;
      return v.length >= min && v.length <= max;
    },
  });

  globalFunctionRegistry.register({
    name: "numeric",
    callableFrom: "rendererOrAgent",
    evaluate: (args, context) => {
      const v = resolveDynamicNumber(args.value, context.dataModel);
      const min =
        args.min !== undefined
          ? resolveDynamicNumber(args.min, context.dataModel)
          : -Infinity;
      const max =
        args.max !== undefined
          ? resolveDynamicNumber(args.max, context.dataModel)
          : Infinity;
      return v >= min && v <= max;
    },
  });
}
