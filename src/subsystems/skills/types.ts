export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
}

export interface SkillRecord extends SkillFrontmatter {
  path: string;
  basePath: string;
  body?: string;
  resources?: string[];
}

export interface SkillDiagnostic {
  path: string;
  message: string;
}
