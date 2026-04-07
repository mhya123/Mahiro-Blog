---
title: Mahiro-Blog 新手教程（十二）：PEM 证书怎么获取（GitHub App 实操）
description: 只讲两件事：GitHub App 的 PEM 私钥怎么获取，以及导入失败时怎么快速排查。
pubDate: 2026-04-07T23:20
aiModel: qwen3-coder-plus
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
