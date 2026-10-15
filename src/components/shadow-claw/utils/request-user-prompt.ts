export async function requestUserPrompt(
  doc: Document,
  shadow: ShadowRoot | null,
  options: {
    question: string;
    options?: string[];
  },
): Promise<string | null> {
  if (!shadow) {
    return null;
  }

  const dialog = shadow.querySelector(
    ".app-prompt-dialog",
  ) as HTMLDialogElement | null;
  const messageEl = shadow.querySelector(
    ".app-prompt-dialog__message",
  ) as HTMLElement | null;
  const inputAreaEl = shadow.querySelector(
    ".app-prompt-dialog__input-area",
  ) as HTMLElement | null;

  if (!dialog || !messageEl || !inputAreaEl) {
    return null;
  }

  if (dialog.open) {
    dialog.close();
  }

  messageEl.textContent = options.question;
  inputAreaEl.replaceChildren();

  if (Array.isArray(options.options) && options.options.length > 0) {
    const select = doc.createElement("select");
    select.className = "app-prompt-dialog__input";
    select.name = "prompt-response";
    for (const opt of options.options) {
      const optionEl = doc.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = opt;

      select.appendChild(optionEl);
    }

    inputAreaEl.appendChild(select);
  } else {
    const input = doc.createElement("input");
    input.type = "text";
    input.className = "app-prompt-dialog__input";
    input.name = "prompt-response";
    input.placeholder = "Enter your response...";
    input.autocomplete = "off";

    inputAreaEl.appendChild(input);

    // Optional: focus after modal is shown
    setTimeout(() => input.focus(), 50);
  }

  dialog.returnValue = "";

  return await new Promise<string | null>((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      if (dialog.returnValue === "submit") {
        const inputEl = inputAreaEl.querySelector(
          "[name='prompt-response']",
        ) as HTMLInputElement | HTMLSelectElement;
        resolve(inputEl ? inputEl.value : null);
      } else {
        resolve(null);
      }
    };

    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}
