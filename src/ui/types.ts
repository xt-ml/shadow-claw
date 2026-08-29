export interface AppDialogLink {
  href: string;
  label: string;
}

export interface AppDialogOptions extends ConfirmationDialogOptions {
  autoCloseSeconds?: number;
  details?: string[];
  links?: AppDialogLink[];
  mode?: "confirm" | "info";
}
export interface ConfirmationDialogOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
}
