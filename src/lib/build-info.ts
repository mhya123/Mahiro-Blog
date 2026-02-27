
// 忽略 TypeScript 对于未知 JSON 的报错，因为该文件在构建或开发时生成
// @ts-ignore
import prebuiltBuildInfo from '../json/build-info.json';

export interface BuildInfoData {
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
 * 获取构建时的项目信息（优先使用预生成 JSON）
 */
export async function getBuildInfo(owner: string, repo: string): Promise<BuildInfoData> {
    if (prebuiltBuildInfo && prebuiltBuildInfo.commitSha) {
        return prebuiltBuildInfo as BuildInfoData;
    }

    // 开发环境如果 JSON 还未生成，返回默认空值
    const now = new Date();
    return {
        commitSha: '',
        commitShort: 'unknown',
        commitMessage: 'No pre-build info found. Run build or node scripts/generate-git-info.mjs.',
        commitAuthor: 'System',
        commitDate: now.toISOString(),
        commitUrl: '',
        buildTime: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        totalCommits: 0,
    };
}
