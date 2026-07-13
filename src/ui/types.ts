

export interface AppDialogLink {
  href: string;
  label: string;
}

export interface AppDialogOptions extends ConfirmationDialogOptions {
  details?: string[];
  links?: AppDialogLink[];
  mode?: "confirm" | "info";
}export interface ConfirmationDialogOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
}
