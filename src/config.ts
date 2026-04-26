// 评论系统配置
import type { Config } from "@interfaces/site";
import * as path from "node:path";
import * as fs from "node:fs";
import yaml from "js-yaml";
import { config as loadDotEnv } from "dotenv";

// 加载 .env 到 process.env
loadDotEnv({ path: path.resolve(".env") });

// 配置文件路径
const configPath = path.resolve("mahiro.config.yaml");
// 翻译文件路径
const translationsPath = path.resolve("src/i18n/translations.yaml");

// 读取并解析 YAML 文件
const config = yaml.load(fs.readFileSync(configPath, "utf8")) as Config;
// 读取并解析翻译文件
const translationsConfig = yaml.load(fs.readFileSync(translationsPath, "utf8")) as Record<string, any>;

// 网站基本信息
export const SITE_URL = config.site.url || "https://www.mahiro.work";
export const SITE_TAB = config.site.tab;

export const SITE_TITLE = config.site.title;
export const SITE_DESCRIPTION = config.site.description;
export const SITE_LANGUAGE = config.site.language;
export const SITE_FAVICON = config.site.favicon;
export const SITE_THEME = config.site.theme;
export const DATE_FORMAT = config.site.date_format;
export const SITE_TRANSLATION = {
  enable: config.site.translation?.enable ?? true,
  defaultProvider: config.site.translation?.defaultProvider || "google",
  defaultTargetLanguage: config.site.translation?.defaultTargetLanguage || "en",
  defaultModel: config.site.translation?.defaultModel || "gpt-5.4-mini",
} as const;

export const SITE_GLASSMORPHISM = config.site.glassmorphism || { enable: true, intensity: 16 };

// Banner 配置 - 使用安全访问  
export const BANNER_CONFIG = config.site.banner;
export const BANNER_IMAGES = config.site.banner?.images || [];
export const BANNER_HEIGHT = config.site.banner?.height || "60vh";
export const DEFAULT_BANNER_MODE = config.site.banner?.defaultMode || "normal";
export const SITE_PAGES = config.site.pages || {};
export const SITE_DRIVE_PERMISSIONS = {
  upload: config.site.pages?.drive?.permissions?.upload ?? false,
  mkdir: config.site.pages?.drive?.permissions?.mkdir ?? false,
  view: config.site.pages?.drive?.permissions?.view ?? true,
  download: config.site.pages?.drive?.permissions?.download ?? true,
  rename: config.site.pages?.drive?.permissions?.rename ?? false,
  copy: config.site.pages?.drive?.permissions?.copy ?? false,
  move: config.site.pages?.drive?.permissions?.move ?? false,
  remove: config.site.pages?.drive?.permissions?.remove ?? false,
} as const;
// 在现有导出后添加  
export const TYPEWRITER_TEXTS = config.site.pages?.home?.typewriterTexts || [];

// 公告配置
export const ANNOUNCEMENT_CONFIG = config.site.announcement || { enable: false, content: '', type: 'info' };

// 博客配置
export const BLOG_CONFIG = config.site.blog;
export const BLOG_PAGE_SIZE = config.site.blog.pageSize;
export const BLOG_PAGINATION_ELLIPSIS_THRESHOLD = Math.max(3, Number(config.site.blog.ellipsisThreshold ?? 9) || 9);
export const COMMIT_HISTORY_SIZE = config.site.blog.commitHistorySize ?? 8;
export const RANDOM_COVER_SOURCES = (
  Array.isArray(config.site.blog.randomCoverSources)
    ? config.site.blog.randomCoverSources.filter((url: unknown) => typeof url === "string" && /^https?:\/\//.test(url))
    : []
);


// GitHub 配置
export const GITHUB_CONFIG = config.github;

// 文章加密密码
export const POST_PASSWORD = process.env.POST_PASSWORD || '';

// 音乐配置
export const MUSIC_CONFIG = config.music || { api: 'https://api.qijieya.cn/meting', autoplay: false, playlist: [] };

// 代码块的主题
export const CODE_THEME = config.site.theme.code;

// 用户个人信息
export const USER_NAME = config.user.name;
export const USER_DESCRIPTION = config.user.description;
export const USER_SITE = config.user.site;
export const USER_AVATAR = config.user.avatar;

// 社交图标配置（侧边栏和页脚）
export const USER_SIDEBAR_SOCIAL_ICONS = config.user.sidebar.social;
export const USER_FOOTER_SOCIAL_ICONS = config.user.footer.social;

const DEFAULT_FOOTER_QUICK_LINKS = [
  { href: "/", icon: "lucide:home", label: "首页" },
  { href: "/about", icon: "lucide:user", label: "关于" },
  { href: "/friend", icon: "lucide:users", label: "友链" },
  { href: "/project", icon: "lucide:folder-kanban", label: "项目" },
  { href: "/navigation", icon: "lucide:compass", label: "导航" },
  { href: "/drive", icon: "lucide:hard-drive", label: "网盘" },
  { href: "/rss.xml", icon: "ri:rss-line", label: "RSS" },
];

const DEFAULT_FOOTER_TECH_STACK = [
  { name: "Astro", href: "https://astro.build" },
  { name: "Tailwind CSS", href: "https://tailwindcss.com" },
  { name: "anime.js", href: "https://animejs.com" },
  { name: "daisyUI", href: "https://daisyui.com" },
  { name: "GSAP", href: "https://gsap.com" },
];

const footerConfig = config.site.footer || {};

export const FOOTER_POWERED_BY_NAME = footerConfig.poweredByName || "Mahiro-Blog";
export const FOOTER_POWERED_BY_URL = footerConfig.poweredByUrl || "https://github.com/mhya123/Mahiro-Blog";
export const FOOTER_POWERED_BY_TEXT = footerConfig.poweredByText || "Powered by";
export const FOOTER_BUILT_WITH_TEXT = footerConfig.builtWithText || "Built with";
export const FOOTER_QUICK_LINKS_TITLE = footerConfig.quickLinksTitle || "导航";
export const FOOTER_SOCIAL_TITLE = footerConfig.socialTitle || "社交";
export const FOOTER_START_YEAR = Number(footerConfig.startYear ?? 2025) || 2025;
export const FOOTER_CRAFTED_BY_TEXT = footerConfig.craftedByText || "Crafted with";

export const FOOTER_ENABLE_BUILD_INFO_CARD = footerConfig.enableBuildInfoCard ?? true;
export const FOOTER_SHOW_BRAND = footerConfig.showBrand ?? true;
export const FOOTER_SHOW_QUICK_LINKS = footerConfig.showQuickLinks ?? true;
export const FOOTER_SHOW_SOCIAL = footerConfig.showSocial ?? true;
export const FOOTER_SHOW_TECH_STACK = footerConfig.showTechStack ?? true;
export const FOOTER_SHOW_STATS = footerConfig.showStats ?? true;
export const FOOTER_SHOW_RECORD_INFO = footerConfig.showRecordInfo ?? true;
export const FOOTER_SHOW_RSS_ICON = footerConfig.showRssIcon ?? true;
export const FOOTER_SHOW_LICENSE = footerConfig.showLicense ?? true;
export const FOOTER_SHOW_CRAFTED_BY = footerConfig.showCraftedBy ?? true;

export const FOOTER_QUICK_LINKS = (
  Array.isArray(config.site.footer?.quickLinks)
    ? config.site.footer!.quickLinks!.filter(
      (item: any) => item && typeof item.href === "string" && typeof item.icon === "string" && typeof item.label === "string",
    )
    : []
);
export const FOOTER_TECH_STACK = (
  Array.isArray(config.site.footer?.techStack)
    ? config.site.footer!.techStack!.filter(
      (item: any) => item && typeof item.name === "string" && typeof item.href === "string",
    )
    : []
);
export const FINAL_FOOTER_QUICK_LINKS = FOOTER_QUICK_LINKS.length > 0 ? FOOTER_QUICK_LINKS : DEFAULT_FOOTER_QUICK_LINKS;
export const FINAL_FOOTER_TECH_STACK = FOOTER_TECH_STACK.length > 0 ? FOOTER_TECH_STACK : DEFAULT_FOOTER_TECH_STACK;

// 网站菜单项配置
export const SITE_MENU = config.site.menu;

// 备案信息
export const SITE_ICP = config.site.icp || "";
export const SITE_ICP_LINK = config.site.icp_link || "https://beian.miit.gov.cn/";
export const SITE_POLICE_BEIAN = config.site.police_beian || "";
export const SITE_POLICE_BEIAN_CODE = config.site.police_beian_code || "";
export const SITE_POLICE_BEIAN_LINK = config.site.police_beian_link || "";

// 赞赏配置
export const REWARD_CONFIG = config.site.reward || { enable: false };

// 多语言文本配置
export const TRANSLATIONS = translationsConfig;

// 评论系统配置
export const commentsConfig = config.comments;

// 创建翻译缓存
const translationCache: Record<string, string> = {};

export function t(key: string): string {
  // 检查缓存中是否已存在此翻译
  if (translationCache[key] !== undefined) {
    return translationCache[key];
  }

  // 获取当前语言的翻译
  const currentLangTranslations = TRANSLATIONS[SITE_LANGUAGE];
  if (!currentLangTranslations) {
    translationCache[key] = key; // 缓存结果
    return key;
  }

  // 查找嵌套翻译
  const keyParts = key.split(".");
  let result = currentLangTranslations;

  for (let i = 0; i < keyParts.length; i++) {
    const part = keyParts[i];

    if (!result || typeof result !== "object") {
      translationCache[key] = key; // 缓存结果
      return key;
    }

    result = result[part];
  }

  // 保存结果到缓存
  translationCache[key] = typeof result === "string" ? result : key;
  return translationCache[key];
}

// Umami 配置接口
export interface UmamiConfig {
  enable: boolean;
  baseUrl: string;
  shareId: string;
  websiteId: string;
  timezone: string;
}

// Umami 配置实例（从配置文件读取）
export const umamiConfig: UmamiConfig = {
  enable: config.umami?.enable ?? false,
  baseUrl: config.umami?.baseUrl ?? "https://umami.mahiro.work",
  shareId: import.meta.env.PUBLIC_UMAMI_SHARE_ID || config.umami?.shareId || "SzhnvI9iUy5fziEI",
  websiteId: import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || config.umami?.websiteId || "",
  timezone: config.umami?.timezone ?? "Asia/Shanghai",
};
