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

export const NAV_DATA: NavCategory[] = [
    {
        title: "开发工具",
        icon: "lucide:code",
        items: [
            /* 
             * 徽章 (Badge) 配置示例：
             * badge: "徽章文本"
             * badgeIcon: "图标名称" (如 "lucide:heart")
             * badgeColor: 支持以下格式
             *   - Tailwind 颜色名: "rose", "sky", "amber" (自动适配深浅色)
             *   - Hex 颜色: "#FF5733"
             *   - RGB 颜色: "rgb(34, 197, 94)"
             */
            {
                name: "Umami",
                avatar: "https://img.xiaozhangya.xin/file/Logo/1753850918996_umami.png",
                description: "网站访问统计分析平台",
                url: "https://us.umami.is/dashboard",
                category: "统计分析",
                id: "DEV001"
            },
            {
                name: "Vercel",
                avatar: "https://img.xiaozhangya.xin/file/Logo/1753851435981_Vercel.png",
                description: "现代化的前端部署平台",
                url: "https://vercel.com/login?next=%2Fkobaridevs-projects",
                category: "部署托管",
                id: "DEV002"
            },
            {
                name: "Iconify",
                avatar: "https://iconify.design/favicon.ico",
                description: "海量图标库和图标搜索工具",
                url: "https://iconify.design/",
                category: "图标设计",
                id: "DEV003"
            },
            {
                name: "Iconfont",
                avatar: "https://img.xiaozhangya.xin/file/Logo/DEPF9Ovv.png",
                description: "阿里巴巴图标库",
                url: "https://www.iconfont.cn/",
                category: "图标设计",
                id: "DEV004"
            },
            {
                name: "Shields",
                avatar: "https://shields.io/img/logo.png",
                description: "为项目生成各种徽章",
                url: "https://shields.io/",
                category: "徽章工具",
                id: "DEV005"
            },
            {
                name: "Clarity",
                avatar: "https://picbed.xiaozhangya.xin/picbed/20250726225237829.png",
                description: "微软的用户行为分析工具",
                url: "https://clarity.microsoft.com/",
                category: "用户分析",
                id: "DEV006"
            }
        ]
    },
    {
        title: "服务平台",
        icon: "lucide:server",
        items: [
            {
                name: "DigitalPlat",
                avatar: "https://picbed.xiaozhangya.xin/picbed/20250726172053106.png",
                description: "免费域名注册",
                url: "https://dash.domain.digitalplat.org/panel/main",
                category: "域名管理",
                id: "SRV001"
            },
            {
                name: "Cloudflare",
                avatar: "https://www.cloudflare.com/favicon.ico",
                description: "全球领先的CDN和安全服务",
                url: "https://dash.cloudflare.com/login",
                category: "域名托管服务",
                id: "SRV002"
            },
            {
                name: "EdgeOne",
                avatar: "https://img.xiaozhangya.xin/file/Logo/cRfyZZ2A.png",
                description: "国内CDN和边缘计算服务",
                url: "https://console.edgeone.cn/login",
                category: "CDN服务",
                id: "SRV003"
            },
            {
                name: "Spaceship",
                avatar: "https://img.xiaozhangya.xin/file/Logo/1753850924810_Spaceship.png",
                description: "A domain odyssey",
                url: "https://www.spaceship.com/",
                category: "域名售卖",
                id: "SRV004"
            },
            {
                name: "Waline",
                avatar: "https://waline.js.org/favicon.ico",
                description: "简洁、安全的评论系统",
                url: "https://waline.js.org/",
                category: "评论服务",
                id: "SRV005"
            },
            {
                name: "Giscus",
                avatar: "https://avatars.githubusercontent.com/ml/9968?s=82&v=4",
                description: "GitHub Discussions 评论系统",
                url: "https://giscus.app/zh-CN",
                category: "评论服务",
                id: "SRV006"
            },
            {
                name: "Akismet",
                avatar: "https://img.xiaozhangya.xin/file/Logo/opkjgCvb.svg",
                description: "保持评论区干净整洁的小助手",
                url: "https://akismet.com/",
                category: "评论服务",
                id: "SRV007"
            },
            {
                name: "GitHub",
                avatar: "https://github.githubassets.com/favicons/favicon.svg",
                description: "全球最大的开源社区",
                url: "https://github.com",
                category: "代码托管",
                id: "SRV008"
            },
            {
                name: "InfinityFree",
                avatar: "https://img.xiaozhangya.xin/file/Logo/1754280946361_InfinityFree.png",
                description: "免费托管WordPress和其他网站",
                url: "https://www.infinityfree.com",
                category: "免费主机",
                id: "SRV009"
            }
        ]
    },
    {
        title: "娱乐资源",
        icon: "lucide:image",
        items: [
            {
                name: "Wallhaven",
                avatar: "https://picbed.xiaozhangya.xin/picbed/20250726182418838.png",
                description: "高质量壁纸分享社区",
                url: "https://wallhaven.cc/",
                category: "壁纸资源",
                id: "ENT001"
            },
            {
                name: "网盘资源社",
                avatar: "https://img.xiaozhangya.xin/file/Logo/RwkDhIdV.png",
                description: "网盘资源分享平台",
                url: "https://www.wpzysq.com/",
                category: "网盘资源",
                id: "ENT002"
            },
            {
                name: "宝可梦节点",
                avatar: "https://52pokemon.huxx.top/favicon.ico",
                description: "网络代理服务",
                url: "https://52pokemon.huxx.top/login",
                category: "代理服务",
                id: "ENT003",
                badge: "好用的加速器",
                badgeIcon: "lucide:zap",
                badgeColor: "amber"
            }
        ]
    },
    {
        title: "Useful Resources",
        icon: "lucide:bookmark",
        items: [
            {
                name: "Astro",
                avatar: "https://img.xiaozhangya.xin/file/Logo/HXADhsBn.png",
                description: "Astro是一个现代化的静态网站生成器",
                url: "https://docs.astro.build",
                category: "文档",
                id: "RES001"
            },
            {
                name: "Tailwind",
                avatar: "https://img.xiaozhangya.xin/file/Logo/mrp0EiyB.png",
                description: "Tailwind CSS是一个功能类优先的CSS框架",
                url: "https://tailwindcss.com/docs",
                category: "文档",
                id: "RES002"
            },
            {
                name: "DaisyUI",
                avatar: "https://img.xiaozhangya.xin/file/Logo/WEl6nL3H.svg",
                description: "DaisyUI是一个基于Tailwind CSS的组件库",
                url: "https://daisyui.com/components/",
                category: "UI 框架",
                id: "RES003"
            },
            {
                name: "TypeScript",
                avatar: "https://img.xiaozhangya.xin/file/Logo/FL3XpMDh.png",
                description: "TypeScript是JavaScript的超集",
                url: "https://www.typescriptlang.org/docs/handbook/intro.html",
                category: "文档",
                id: "RES004"
            }
        ]
    }
];
