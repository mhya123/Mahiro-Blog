
export const INIT_DELAY = 0.3
export const ANIMATION_DELAY = 0.1
export const CARD_SPACING = 36
export const CARD_SPACING_SM = 24
export const BLOG_SLUG_KEY = import.meta.env.BLOG_SLUG_KEY || ''
export const SITE_REMOTE_API_BASE_URL = (import.meta.env.PUBLIC_SITE_API_BASE_URL || 'https://back.mahiro.work').replace(/\/+$/, '')
export const SITE_LOCAL_API_BASE_URL = (
	import.meta.env.DEV
		? '/__mahiro_api'
		: (import.meta.env.PUBLIC_LOCAL_SITE_API_BASE_URL || '')
).replace(/\/+$/, '')
export const SITE_API_BASE_URL = (import.meta.env.DEV ? SITE_LOCAL_API_BASE_URL : SITE_REMOTE_API_BASE_URL).replace(/\/+$/, '')

/**
 * GitHub 仓库配置
 */
export const GITHUB_CONFIG = {
	OWNER: import.meta.env.PUBLIC_GITHUB_OWNER || import.meta.env.NEXT_PUBLIC_GITHUB_OWNER || import.meta.env.YAML_GITHUB_CONFIG?.owner || 'mhya123',
	REPO: import.meta.env.PUBLIC_GITHUB_REPO || import.meta.env.NEXT_PUBLIC_GITHUB_REPO || import.meta.env.YAML_GITHUB_CONFIG?.repo || 'Mahiro-Blog',
	BRANCH: import.meta.env.PUBLIC_GITHUB_BRANCH || import.meta.env.NEXT_PUBLIC_GITHUB_BRANCH || import.meta.env.YAML_GITHUB_CONFIG?.branch || 'main',
	APP_ID: import.meta.env.PUBLIC_GITHUB_APP_ID || import.meta.env.NEXT_PUBLIC_GITHUB_APP_ID || import.meta.env.YAML_GITHUB_CONFIG?.appId || '-',
	ENCRYPT_KEY: import.meta.env.PUBLIC_GITHUB_ENCRYPT_KEY || import.meta.env.YAML_GITHUB_CONFIG?.encryptKey || 'wudishiduomejimo',
} as const
