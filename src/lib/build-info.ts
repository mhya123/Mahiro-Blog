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
 * 在构建时获取项目的构建信息
 */
export function getBuildInfo(owner: string, repo: string): BuildInfo {
    const now = new Date();
    const buildTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    try {
        // 最近一次提交
        const logResult = execSync(
            'git log -1 --format="%H|||%h|||%s|||%an|||%aI"',
            { encoding: 'utf-8', timeout: 5000 }
        ).trim().replace(/^"|"$/g, '');

        const [commitSha, commitShort, commitMessage, commitAuthor, commitDate] = logResult.split('|||');

        // 总提交数
        let totalCommits = 0;
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
            commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
            buildTime,
            totalCommits,
        };
    } catch (error) {
        console.warn('Failed to get build info:', error);
        return {
            commitSha: '',
            commitShort: 'unknown',
            commitMessage: '',
            commitAuthor: '',
            commitDate: '',
            commitUrl: '',
            buildTime,
            totalCommits: 0,
        };
    }
}
