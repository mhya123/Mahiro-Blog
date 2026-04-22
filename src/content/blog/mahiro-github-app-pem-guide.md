---
title: Mahiro-Blog 新手教程（十二）：PEM 证书怎么获取（GitHub App 实操）
description: 只讲两件事：GitHub App 的 PEM 私钥怎么获取，以及导入失败时怎么快速排查。
pubDate: 2026-04-07T23:20
aiModel: gpt-5.2
image: /images/covers/mahiro-github-app-pem-guide.webp
draft: false
tags:
  - PEM
  - GitHub App
  - 导入失败
  - 教程
  - 排错
categories:
  - 教程
---

> [!ai] ChatGPT-5.2
> 在 GitHub 网页通过 Settings→Developer settings→GitHub Apps→你的 App→Private keys→Generate a private key 下载 .pem（如 xxx.日期.private-key.pem）。在 Mahiro-Blog 的 /config 点“验证”选择 .pem，提示导入成功即可。导入失败排查：后缀非 .pem、PEM 头尾行缺失或格式损坏、appId 与 PEM 非同一 App、私钥失效/撤销需重生成、会话存储被清理需重导入，仍失败则生成新 PEM 保持同一 appId 重新测试。

这篇只讲两部分：

1. **怎么获取 PEM 私钥**
2. **导入失败时怎么排查**

---

## 1. 怎么获取 PEM（GitHub 网页）

按这条路径操作：

1. 打开 GitHub 右上角头像 → `Settings`
2. 左侧进入 `Developer settings`
3. 点击 `GitHub Apps`
4. 进入你的 App（没有就先创建）
5. 在 `Private keys` 区域点击 `Generate a private key`

浏览器会下载一个文件，通常类似：

- `xxx.2026-04-07.private-key.pem`

这个文件就是你要的 PEM。

---

## 2. 在 Mahiro-Blog 里怎么导入

当前项目是“在线导入”：

1. 打开配置页 `/config`
2. 点击“验证”（钥匙按钮）
3. 选择你刚下载的 `.pem` 文件
4. 看到“密钥导入成功”即可

---

## 3. 导入失败怎么排查（只看这 6 条）

### 1) 文件不是 `.pem`

导入控件限制了 `accept=.pem`，先确认后缀正确。

### 2) PEM 内容格式损坏

检查是否包含：

- `-----BEGIN ... PRIVATE KEY-----`
- `-----END ... PRIVATE KEY-----`

不要丢头尾行，不要多复制空格。

---

### 3) App ID 和 PEM 不是同一个 App

这是最常见错误：

- `mahiro.config.yaml` 里的 `github.appId` 必须和该 PEM 同源
- 不同 App 的 PEM 不能混用

### 4) 私钥已失效/被撤销

去 GitHub App 页面重新 `Generate a private key`，然后重新导入。

### 5) 浏览器会话被清理

项目把密钥缓存到会话存储，清理浏览器数据后需要重新导入。

### 6) 仍失败：直接重建一对

最快路径：

1. 在 GitHub App 再生成一个新 PEM
2. 确认 `appId` 不变且对应同一 App
3. 重新导入测试

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-config-env-multi-platform-pages" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">新手教程（十一）：mahiro.config.yaml 与 .env 在多平台部署</div>
      <div class="text-sm text-base-content/60">先搞定多平台变量治理，再处理 GitHub App PEM 导入链路。</div>
    </div>
  </a>

  <a href="/blog/mahiro-secondary-dev-index" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">进阶入口</div>
      <div class="font-semibold text-base">进入 Mahiro-Blog 二开实战总览</div>
      <div class="text-sm text-base-content/60">完成 PEM 与认证链路后，继续进入组件和架构级二开实战。</div>
    </div>
  </a>
</div>

---

## 新手专栏目录入口

<div class="mt-4">
  <a href="/blog/mahiro-beginner-tutorial-index" class="card bg-base-100 border border-primary/30 hover:border-primary transition-all duration-300 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">专栏目录</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手专栏：完整学习路径</div>
      <div class="text-sm text-base-content/60">查看新手教程总览与推荐阅读顺序（持续更新）。</div>
    </div>
  </a>
</div>