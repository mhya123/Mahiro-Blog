export interface NavItem {
    name: string;
    avatar: string;
    description: string;
    url: string;
    category: string;
    id?: string;
    badge?: string;
    badgeIcon?: string;
    badgeColor?: string;
}

export interface NavCategory {
    title: string;
    icon: string;
    items: NavItem[];
}

// 使用 import.meta.glob 自动加载所有导航 JSON 文件
const navModules = import.meta.glob<{ default: NavCategory }>('/src/data/navigation/*.json', { eager: true });

export const NAV_DATA: NavCategory[] = Object.entries(navModules)
  .filter(([_, mod]) => mod?.default)
  .map(([_, mod]) => mod.default);
