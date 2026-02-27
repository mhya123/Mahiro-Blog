import { execSync } from 'node:child_process';
import type { CommitData } from '@/components/widgets/CommitHistory';

/**
 * 在构建时通过 git log 或 GitHub API 获取指定文件的提交历史
 * 优先使用 GitHub API 防止云部署平台的浅克隆和服务器端 fetch 缓存导致记录过时
 */
export async function getFileCommits(filePath: string, owner: string, repo: string, maxCount = 20): Promise<CommitData[]> {
    if (owner && repo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&per_page=${maxCount}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Mahiro-Blog-Build'
                },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.map((item: any) => ({
                        sha: item.sha,
                        message: item.commit.message.split('\n')[0],
                        authorName: item.commit.author.name,
                        date: item.commit.author.date,
                        url: item.html_url,
                    }));
                }
            }
        } catch (error) {
            console.warn(`Failed to fetch commits from GitHub API for ${filePath}, falling back to local git.`);
        }
    }

    try {
        // 降级：使用 git log 获取本地提交记录
        const separator = '|||';
        const format = `%H${separator}%s${separator}%an${separator}%aI`;
        const result = execSync(
            `git log --format="${format}" --max-count=${maxCount} -- "${filePath}"`,
            { encoding: 'utf-8', timeout: 10000 }
        ).trim();

        if (!result) return [];

        return result.split('\n').filter(Boolean).map(line => {
            const [sha, message, authorName, date] = line.split(separator);
            return {
                sha,
                message,
                authorName,
                date,
                url: owner && repo ? `https://github.com/${owner}/${repo}/commit/${sha}` : '',
            };
        });
    } catch (error) {
        console.warn(`Failed to get git log for ${filePath}:`, error);
        return [];
    }
}
