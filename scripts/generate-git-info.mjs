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

// 检查是否在持续集成/部署环境中运行 (Vercel, Cloudflare, etc)
const isCI = process.env.CI || process.env.VERCEL || process.env.CF_PAGES;

// ============================================
// 1. 生成全局 Build Info 
// ============================================

async function generateBuildInfo() {
    const now = new Date();
    const buildTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let commitSha = '';
    let commitShort = 'unknown';
    let commitMessage = '';
    let commitAuthor = '';
    let commitDate = '';
    let commitUrl = '';
    let totalCommits = 0;

    // 如果在 CI 环境且有配置，优先使用 GitHub API 避免浅克隆问题
    if (isCI && owner && repo) {
        try {
            console.log('[Generate Git Info] 检测到 CI 环境，从 GitHub API 获取全局构建信息...');
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
                    commitMessage = latest.commit.message.split('\n')[0];
                    commitAuthor = latest.commit.author.name;
                    commitDate = latest.commit.author.date;
                    commitUrl = latest.html_url;
                }
            } else {
                console.warn(`[Generate Git Info] API 请求失败: ${response.status} ${response.statusText}`);
            }
        } catch (apiError) {
            console.warn('[Generate Git Info] API 获取失败，尝试回退:', apiError.message);
        }
    }

    // 本地开发或 API 失败时，降级使用 Git Log
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
        } catch (e) {
            console.warn('[Generate Git Info] 无法拉取全局 git log -1', e.message);
        }
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

async function generateBlogGitHistory() {
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
        // 提取绝对唯一的相对路径格式 (src/content/blog/xxx.md)，无视运行环境的工作目录深度
        const posixPath = filePath.replace(/\\/g, '/');
        const relativePath = posixPath.substring(posixPath.indexOf('src/content/blog/'));
        let fileCommits = [];

        // 在 CI 环境尝试优先从 API 拉取单个文件的提交
        if (isCI && owner && repo) {
            try {
                const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${relativePath}&per_page=${maxCount}`, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Mahiro-Blog-Build'
                    },
                    cache: 'no-store'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        fileCommits = data.map((item) => ({
                            sha: item.sha,
                            message: item.commit.message.split('\n')[0],
                            authorName: item.commit.author.name,
                            date: item.commit.author.date,
                            url: item.html_url,
                        }));
                    }
                }
            } catch (error) {
                // Ignore API errors, fallback to local git
            }
        }

        // 如果未抓取到或在本地环境，回退到 git log
        if (fileCommits.length === 0) {
            try {
                const separator = '|||';
                const format = `%H${separator}%s${separator}%an${separator}%aI`;

                const result = execSync(
                    `git log --format="${format}" --max-count=${maxCount} -- "${relativePath}"`,
                    { encoding: 'utf-8', timeout: 10000 }
                ).trim();

                if (result) {
                    fileCommits = result.split('\n').filter(Boolean).map(line => {
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
                console.warn(`[Generate Git Info] 无法提取文件本地历史记录: ${filePath}`, e.message);
            }
        }

        if (fileCommits.length > 0) {
            gitHistoryData[relativePath] = fileCommits;
        }
    }

    const gitHistoryPath = path.join(jsonDir, 'git-history.json');
    fs.writeFileSync(gitHistoryPath, JSON.stringify(gitHistoryData, null, 2), 'utf-8');
    console.log(`[Generate Git Info] 成功生成: ${gitHistoryPath} (包含 ${Object.keys(gitHistoryData).length} 篇文章的历史)`);
}

// 运行功能
async function run() {
    await generateBuildInfo();
    await generateBlogGitHistory();
}

run();
