import type { CommitData } from '@/components/widgets/CommitHistory';
// 忽略 TypeScript 对于未知 JSON 的报错，因为该文件在构建或开发时生成
// @ts-ignore
import gitHistory from '../json/git-history.json';

/**
 * 获取指定文件的提交历史（从预生成的 JSON 中读取）
 * 这样不受 Vercel 等平台浅克隆的影响，并且没有任何外部 API 请求延迟
 */
export async function getFileCommits(filePath: string, owner: string, repo: string, maxCount = 20): Promise<CommitData[]> {
    try {
        // 将 Windows 的反斜杠统一替换为正斜杠，以匹配生成的 JSON key
        const normalizedPath = filePath.replace(/\\/g, '/');
        const historyRecord = gitHistory as Record<string, CommitData[]>;

        if (historyRecord && historyRecord[normalizedPath]) {
            // 返回对应文件的历史记录，并限制最大数量
            return historyRecord[normalizedPath].slice(0, maxCount);
        }

        return [];
    } catch (e) {
        console.warn(`Failed to get pre-built git history for post: ${filePath}`, e);
        return [];
    }
}
