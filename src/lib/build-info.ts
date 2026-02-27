import { execSync } from 'node:child_process';

export interface BuildInfo {
    commitSha: string;
    commitShort: string;
    commitMessage: string;
    commitAuthor: string;
    commitDate: string;
    commitUrl: string;
    buildTime: string;
    totalCommits: number;
}

/**
 * 在构建时获取项目的构建信息，优先从 GitHub API 获取以保证数据是最新的
 */
export async function getBuildInfo(owner: string, repo: string): Promise<BuildInfo> {
    const now = new Date();
    const buildTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let commitSha = '';
    let commitShort = 'unknown';
    let commitMessage = '';
    let commitAuthor = '';
    let commitDate = '';
    let commitUrl = '';
    let totalCommits = 0;

    // 优先尝试使用 GitHub API 获取最新 commit，解决 CI/CD 服务器上 .git 目录可能被浅克隆导致更新慢的问题
    if (owner && repo) {
        try {
            // 获取最新的一条 commit，必须禁用缓存否则部署平台会加载旧数据
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Mahiro-Blog-Build'
                },
                cache: 'no-store'
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    const latest = data[0];
                    commitSha = latest.sha;
                    commitShort = latest.sha.substring(0, 7);
                    commitMessage = latest.commit.message.split('\n')[0]; // 取第一行
                    commitAuthor = latest.commit.author.name;
                    commitDate = latest.commit.author.date;
                    commitUrl = latest.html_url;
                }
            }
        } catch (apiError) {
            console.warn('Failed to fetch from GitHub API, falling back to local git info.');
        }
    }

    // 如果 GitHub API 获取失败，降级回退到本地 git 命令
    if (!commitSha) {
        try {
            const logResult = execSync(
                'git log -1 --format="%H|||%h|||%s|||%an|||%aI"',
                { encoding: 'utf-8', timeout: 5000 }
            ).trim().replace(/^"|"$/g, '');

            const parts = logResult.split('|||');
            if (parts.length === 5) {
                commitSha = parts[0];
                commitShort = parts[1];
                commitMessage = parts[2];
                commitAuthor = parts[3];
                commitDate = parts[4];
                commitUrl = owner && repo ? `https://github.com/${owner}/${repo}/commit/${commitSha}` : '';
            }
        } catch (localError) {
            console.warn('Failed to get local git info.');
        }
    }

    // 获取总提交数 (尽可能使用本地获取，API对列表获取有限制)
    try {
        totalCommits = parseInt(
            execSync('git rev-list --count HEAD', { encoding: 'utf-8', timeout: 5000 }).trim(),
            10
        );
    } catch { /* ignore */ }

    return {
        commitSha,
        commitShort,
        commitMessage,
        commitAuthor,
        commitDate,
        commitUrl,
        buildTime,
        totalCommits,
    };
}
