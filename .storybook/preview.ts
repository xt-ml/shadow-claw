import { themes } from "storybook/theming";
import "../index.css";

const preview = {
  initialGlobals: {
    backgrounds: {
      value: "dark",
    },
  },
  parameters: {
    layout: "padded",
    docs: {
      theme: themes.dark,
    },
    backgrounds: {
      default: "dark",
      options: {
        dark: { name: "dark", value: "#0f172a" },
        light: { name: "light", value: "#f8fafc" },
      },
    },
  },
  decorators: [
    (story, context) => {
      const isLight = context.globals.backgrounds?.value === "light";
      const themeClass = isLight ? "light-mode" : "dark-mode";

      document.documentElement.classList.remove("light-mode", "dark-mode");
      document.documentElement.classList.add(themeClass);
      document.body.classList.remove("light-mode", "dark-mode");
      document.body.classList.add(themeClass);

      const root = document.createElement("div");
      root.className = themeClass;
      root.style.color = "var(--shadow-claw-text-primary)";
      root.style.fontFamily = "var(--shadow-claw-font-sans)";
      root.style.boxSizing = "border-box";
      root.append(story());
      return root;
    },
  ],
};

export default preview;
