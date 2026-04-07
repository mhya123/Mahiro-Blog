---
title: Mahiro-Blog 二开实战（二）：数据流与 JSON 管道设计
description: 面向长期维护的二开实践，讲清页面数据来源、JSON 组织规范与增量演进方式。
pubDate: 2026-04-07T17:35
aiModel: qwen3-coder-plus
image: /home.webp
draft: false
tags:
  - 二开
  - 数据流
  - JSON
  - 可维护性
  - 工程化
categories:
  - 教程
---

做二开最怕的不是“现在能不能显示”，而是“半年后还能不能改”。

数据结构设计就是这个问题的核心。

---

## 1. 先画出你的数据流

建议你把数据来源按 3 类拆开：

1. **内容数据**：`src/content/blog/*`
2. **配置数据**：`mahiro.config.yaml`
3. **展示数据**：`src/data/*.json`

这样定位问题时会快很多：是内容错、配置错，还是 JSON 错。

---

## 2. JSON 管理的基本约束

建议统一执行：

- 文件命名语义化
- 字段尽量稳定
- 可选字段必须有兜底逻辑

你后续的自动审核、页面筛选、迁移脚本都会因此受益。

---

## 3. 一个可扩展字段策略

字段建议分三类：

- 必填字段：保证页面可渲染
- 可选字段：增强展示能力
- 衍生字段：运行时计算，不入库

这个策略可以显著降低 schema 变更成本。

---

## 4. 数据改造时的“兼容优先”原则

新增字段时不要破坏旧数据：

- 新字段默认可选
- 组件使用时判空
- 旧数据无该字段也能正常渲染

这能避免“一次升级，全站报错”。

---

## 5. 常见坑位

### 5.1 同名字段语义不一致

例如多个 JSON 都有 `type`，但含义不同，后续很容易混乱。

### 5.2 页面直接依赖原始 JSON

建议先经过映射层再渲染，便于后续 schema 变更。

### 5.3 没有兜底值

空字段直出到 UI，最容易导致页面断裂。

---

## 6. 二开建议

- 把“数据规范”写进文档
- 把“字段校验”写进 CI（后续可加）
- 每次 schema 变更附带迁移说明

你做的是“系统”，不是一次性页面。

---

## 系列导航（二开实战）

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-secondary-dev-component-refactor" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">二开实战（一）：组件重构与可维护目录拆分</div>
      <div class="text-sm text-base-content/60">先拆结构，再稳数据。</div>
    </div>
  </a>

  <a href="/blog/mahiro-secondary-dev-workflow-automation" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">二开实战（三）：自动化工作流与审核策略</div>
      <div class="text-sm text-base-content/60">把维护流程自动化，降低运营成本。</div>
    </div>
  </a>
</div>

---

## 二开总览入口

<div class="mt-4">
  <a href="/blog/mahiro-secondary-dev-index" class="card bg-base-100 border border-primary/30 hover:border-primary transition-all duration-300 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">二开实战总览</div>
      <div class="font-semibold text-base">Mahiro-Blog 二开实战总览：从可运行到可演进</div>
      <div class="text-sm text-base-content/60">统一查看二开四连篇与进阶阅读路径。</div>
    </div>
  </a>
</div>
