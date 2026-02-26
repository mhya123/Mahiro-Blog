import { execSync } from 'node:child_process';
import type { CommitData } from '@/components/widgets/CommitHistory';

/**
 * 在构建时通过 git log 获取指定文件的提交历史
 * 这样前端无需 GitHub API，游客也能看到修订记录
 */
export function getFileCommits(filePath: string, owner: string, repo: string, maxCount = 20): CommitData[] {
    try {
        // 使用 git log 获取提交记录
        // 格式: sha|message|authorName|date
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
                url: `https://github.com/${owner}/${repo}/commit/${sha}`,
            };
        });
    } catch (error) {
        console.warn(`Failed to get git log for ${filePath}:`, error);
        return [];
    }
}
