
export const INIT_DELAY = 0.3
export const ANIMATION_DELAY = 0.1
export const CARD_SPACING = 36
export const CARD_SPACING_SM = 24
export const BLOG_SLUG_KEY = import.meta.env.BLOG_SLUG_KEY || ''

/**
 * GitHub 仓库配置
 */
export const GITHUB_CONFIG = {
	OWNER: import.meta.env.PUBLIC_GITHUB_OWNER || import.meta.env.NEXT_PUBLIC_GITHUB_OWNER || import.meta.env.YAML_GITHUB_CONFIG?.owner || 'kobaridev',
	REPO: import.meta.env.PUBLIC_GITHUB_REPO || import.meta.env.NEXT_PUBLIC_GITHUB_REPO || import.meta.env.YAML_GITHUB_CONFIG?.repo || 'RyuChan',
	BRANCH: import.meta.env.PUBLIC_GITHUB_BRANCH || import.meta.env.NEXT_PUBLIC_GITHUB_BRANCH || import.meta.env.YAML_GITHUB_CONFIG?.branch || 'main',
	APP_ID: import.meta.env.PUBLIC_GITHUB_APP_ID || import.meta.env.NEXT_PUBLIC_GITHUB_APP_ID || import.meta.env.YAML_GITHUB_CONFIG?.appId || '-',
	ENCRYPT_KEY: import.meta.env.PUBLIC_GITHUB_ENCRYPT_KEY || import.meta.env.YAML_GITHUB_CONFIG?.encryptKey || 'wudishiduomejimo',
} as const
