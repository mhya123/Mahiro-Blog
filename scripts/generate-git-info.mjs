import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';

// 读取 mahiro.config.yaml 提取 owner 和 repo
const configPath = path.resolve(process.cwd(), 'mahiro.config.yaml');
let owner = '';
let repo = '';

try {
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(configContent);
        owner = config?.github?.owner || '';
        repo = config?.github?.repo || '';
    }
} catch (error) {
    console.error('[Generate Git Info] 无法读取 mahiro.config.yaml:', error);
}

// 确保目标文件夹存在
const jsonDir = path.resolve(process.cwd(), 'src/json');
if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
}

// ============================================
// 1. 生成全局 Build Info 
// ============================================

function generateBuildInfo() {
    const now = new Date();
    const buildTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let commitSha = '';
    let commitShort = 'unknown';
    let commitMessage = '';
    let commitAuthor = '';
    let commitDate = '';
    let commitUrl = '';
    let totalCommits = 0;

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
    } catch (e) {
        console.warn('[Generate Git Info] 无法拉取全局 git log -1', e.message);
    }

    try {
        totalCommits = parseInt(
            execSync('git rev-list --count HEAD', { encoding: 'utf-8', timeout: 5000 }).trim(),
            10
        );
    } catch { /* ignore */ }

    const buildInfoData = {
        commitSha,
        commitShort,
        commitMessage,
        commitAuthor,
        commitDate,
        commitUrl,
        buildTime,
        totalCommits,
    };

    // 确保目标文件存在
    const buildInfoPath = path.join(jsonDir, 'build-info.json');
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfoData, null, 2), 'utf-8');
    console.log(`[Generate Git Info] 成功生成: ${buildInfoPath}`);
}

// ============================================
// 2. 生成具体文件（博客文章）的 Git History
// ============================================

function generateBlogGitHistory() {
    const blogDir = path.resolve(process.cwd(), 'src/content/blog');

    if (!fs.existsSync(blogDir)) {
        console.warn('[Generate Git Info] 找不到博客目录: ', blogDir);
        return;
    }

    // 递归寻找所有的博客文章
    function walkSync(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walkSync(file));
            } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
                results.push(file);
            }
        });
        return results;
    }

    const mdFiles = walkSync(blogDir);

    const gitHistoryData = {};
    const maxCount = 20;

    for (const filePath of mdFiles) {
        try {
            // 提取相对于项目根目录的相对路径
            const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            const separator = '|||';
            const format = `%H${separator}%s${separator}%an${separator}%aI`;

            const result = execSync(
                `git log --format="${format}" --max-count=${maxCount} -- "${relativePath}"`,
                { encoding: 'utf-8', timeout: 10000 }
            ).trim();

            if (result) {
                gitHistoryData[relativePath] = result.split('\n').filter(Boolean).map(line => {
                    const [sha, message, authorName, date] = line.split(separator);
                    return {
                        sha,
                        message,
                        authorName,
                        date,
                        url: owner && repo ? `https://github.com/${owner}/${repo}/commit/${sha}` : '',
                    };
                });
            }
        } catch (e) {
            console.warn(`[Generate Git Info] 无法提取文件历史记录: ${filePath}`, e.message);
        }
    }

    const gitHistoryPath = path.join(jsonDir, 'git-history.json');
    fs.writeFileSync(gitHistoryPath, JSON.stringify(gitHistoryData, null, 2), 'utf-8');
    console.log(`[Generate Git Info] 成功生成: ${gitHistoryPath} (包含 ${Object.keys(gitHistoryData).length} 篇文章的历史)`);
}

// 运行功能
generateBuildInfo();
generateBlogGitHistory();
