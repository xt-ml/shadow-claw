import type { TaskToolCall } from "../../db/types.js";

export interface SkillExecution {
  type: "tools";
  suppressToast?: boolean;
  suppressOutput?: boolean;
  tools: TaskToolCall[];
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  execution?: SkillExecution;
}

export interface SkillRecord extends SkillFrontmatter {
  path: string;
  basePath: string;
  body?: string;
  resources?: string[];
  groupId?: string;
}

export interface SkillDiagnostic {
  path: string;
  message: string;
}
