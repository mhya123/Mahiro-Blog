import type { AstroIntegration } from "astro";
import path from "node:path";

export default function updateConfigPlugin(): AstroIntegration {
  return {
    name: "watch-mahiro-config",
    hooks: {
      "astro:config:setup": ({ addWatchFile }) => {
        // 让 Astro 监视根目录下的配置文件
        addWatchFile(path.resolve("mahiro.config.yaml"));
        addWatchFile(path.resolve("src/i18n/translations.yaml"));
      },
    },
  };
}
