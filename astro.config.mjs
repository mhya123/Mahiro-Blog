import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import playformCompress from "@playform/compress";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { CODE_THEME, USER_SITE, GITHUB_CONFIG } from "./src/config.ts";
import { rehypeAiSummaryCards } from "./src/plugins/rehype-ai-summary-cards.ts";

import updateConfig from "./src/integration/updateConfig.ts";

import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";

const enableHeavyBuild = process.env.MAHIRO_ENABLE_HEAVY_BUILD === "true";
const backendApiTarget = (process.env.PUBLIC_SITE_API_BASE_URL || "https://back.mahiro.work").replace(/\/+$/, "");

// https://astro.build/config
export default defineConfig({
  vite: {
    envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'],
    optimizeDeps: {
      include: ['mammoth'],
    },
    define: {
      'import.meta.env.YAML_GITHUB_CONFIG': JSON.stringify(GITHUB_CONFIG || null),
    },
    build: {
      minify: "esbuild",
    },
    worker: {
      format: "es",
      },
      css: {
        preprocessorOptions: {
          scss: {
            api: "modern-compiler",
            silenceDeprecations: ["import"],
          },
        },
      },
      server: {
        proxy: {
          "/__mahiro_api": {
            target: backendApiTarget,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/__mahiro_api/, ""),
          },
        },
      },
      preview: {
      proxy: {
        "/__mahiro_api": {
          target: backendApiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/__mahiro_api/, ""),
        },
      },
    },
  },
  site: USER_SITE,
  output: "static",
  style: {
    scss: {
      includePaths: ["./src/styles"],
    },
  },
  integrations: [
    updateConfig(),
    react(),
    mdx(),
    icon(),
    sitemap(),
    tailwind({
      configFile: "./tailwind.config.mjs",
    }),
    ...(enableHeavyBuild ? [playformCompress()] : []),
  ],
  markdown: {
    shikiConfig: {
      theme: CODE_THEME,
      transformers: [{
        preprocess(code, options) {
          this.meta = { lang: options.lang || "plaintext" };
          return code;
        },
        pre(node) {
          const language = this.meta?.lang.toUpperCase() || "plaintext";

          return {
            type: "element",
            tagName: "div",
            properties: {
              class: "not-prose mahiro-code",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "mahiro-code-toolbar",
                },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    properties: { class: "mahiro-code-toolbar-language" },
                    children: [{ type: "text", value: language }],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      "class": "btn-copy",
                      "aria-label": "Copy code",
                      "type": "button",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "span",
                        properties: {
                          "class": "mahiro-code-toolbar-copy-icon",
                          "aria-hidden": "true",
                        },
                        children: [
                          {
                            type: "element",
                            tagName: "svg",
                            properties: {
                              "xmlns": "http://www.w3.org/2000/svg",
                              "width": "18",
                              "height": "18",
                              "viewBox": "0 0 24 24",
                              "fill": "none",
                              "stroke": "currentColor",
                              "stroke-width": "2",
                              "stroke-linecap": "round",
                              "stroke-linejoin": "round",
                              "class": "copy-icon",
                            },
                            children: [
                              {
                                type: "element",
                                tagName: "rect",
                                properties: {
                                  x: "9",
                                  y: "9",
                                  width: "13",
                                  height: "13",
                                  rx: "2",
                                  ry: "2",
                                },
                                children: [],
                              },
                              {
                                type: "element",
                                tagName: "path",
                                properties: {
                                  d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
                                },
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "element",
                        tagName: "span",
                        properties: {
                          "class": "mahiro-code-toolbar-copy-success hidden",
                          "aria-hidden": "true",
                        },
                        children: [
                          {
                            type: "element",
                            tagName: "svg",
                            properties: {
                              "xmlns": "http://www.w3.org/2000/svg",
                              "width": "18",
                              "height": "18",
                              "viewBox": "0 0 24 24",
                              "fill": "none",
                              "stroke": "currentColor",
                              "stroke-width": "2",
                              "stroke-linecap": "round",
                              "stroke-linejoin": "round",
                              "class": "success-icon",
                            },
                            children: [
                              {
                                type: "element",
                                tagName: "path",
                                properties: {
                                  d: "M20 6L9 17l-5-5",
                                },
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                ...node,
                properties: {
                  ...node.properties,
                  class: "mahiro-code-content",
                },
                children: [
                  {
                    type: "element",
                    tagName: "code",
                    properties: {
                      class: "grid [&>.line]:px-4",
                      style: "counter-reset: line",
                    },
                    children: node.children,
                  },
                ],
              },
            ],
          };
        },
        line(node) {
          return {
            ...node,
            properties: {
              ...node.properties,
              class: "line before:content-[counter(line)]",
              style: "counter-increment: line",
            },
          };
        },
        code(node) {
          delete node.properties.style;
          return node;
        },
      },
      ],
    },
    remarkPlugins: [remarkMath, remarkReadingTime],
    rehypePlugins: [rehypeKatex, rehypeAiSummaryCards, [
      rehypeExternalLinks,
      {
        content: { type: "text", value: "↗" },
      },
    ]],
  },
});
