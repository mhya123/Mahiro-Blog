---
title: Umami v3 数据库可视化管理与访问量修改教程
description: ''
pubDate: 2026-02-27T21:07
draft: false
tags: [umami,docker,sql,教程]
categories: [教程]
---
本教程将引导你安全地使用可视化网页工具（Adminer）连接到通过 Docker 部署的 Umami 数据库，并使用 SQL 脚本安全地批量修改网站的访客数与浏览量。

## 一、 开启可视化数据库面板

为了不破坏 Umami 现有的内部网络配置（避免出现 Prisma 无法连接的报错），我们将使用最安全的方式：在独立的容器中临时运行一个 Adminer 可视化面板，并将其接入 Umami 的内部网络。

在你的服务器终端中，运行以下命令：

```bash
docker run -d --name umami-adminer --network umami_default -p 8080:8080 adminer
```

*说明：此命令会在后台启动一个轻量级的数据库管理工具，并将网页访问端口映射到你服务器的 `8080` 端口。请确保服务器防火墙或云服务商安全组已放行 8080 端口。*

---

## 二、 登录数据库

1. 打开电脑浏览器，访问地址：`http://你的服务器公网IP:8080`
2. 在出现的登录界面中，按照以下清单准确填写：

* **系统 (System)**：选择 `PostgreSQL`
* **服务器 (Server)**：填写 `umami-db-1`（Docker 内部的网络容器名）
* **用户名 (Username)**：填写你的数据库用户名（默认为 `umami`）
* **密码 (Password)**：填写你的数据库密码（默认为 `umami`）
* **数据库 (Database)**：填写你的数据库名（默认为 `umami`）

填写完毕后，点击登录即可进入数据库可视化管理后台。

---

## 三、 使用 SQL 命令批量补充浏览数据

Umami v3 的访客和浏览量是由 `session`（访客会话表）和 `website_event`（事件浏览表）两条记录共同构成的。如果只加浏览量不加访客，数据面板会显得非常不自然。

1. 登录 Adminer 后，点击左上角的 **“SQL 命令 (SQL command)”**。
2. 将下方经过严格测试的自动化脚本粘贴到文本框中。
3. **注意修改脚本中的参数：**
* `15305`：代表你要增加的浏览量/访客数，请替换为你需要的数字（注意数字和后面的 `LOOP` 之间必须保留一个空格）。
* `'49720733-f763-40bd-9d11-fcb88cfa5333'`：请替换为你自己的实际网站 ID。
* `'/'`：如果你想修改其他页面（如 `/about`），请修改此处的路径。



**执行脚本代码：**

```sql
DO $$
DECLARE
    i INT;
    v_session_id uuid;
    v_visit_id uuid;
    v_event_id uuid;
    v_rand_time timestamptz;
BEGIN
    -- 重点在这里：修改 1..后面的数字为你想要增加的总访问量（数字与LOOP间保留空格）
    FOR i IN 1..15305 LOOP
        -- 1. 为这次访问生成一套专属的随机 ID 和 随机时间（打散在过去30天内，让数据更真实）
        v_session_id := gen_random_uuid();
        v_visit_id := gen_random_uuid();
        v_event_id := gen_random_uuid();
        v_rand_time := NOW() - (random() * interval '30 days');

        -- 2. 写入 session 表 (登记这是一个新访客)
        INSERT INTO session (session_id, website_id, created_at)
        VALUES (v_session_id, '49720733-f763-40bd-9d11-fcb88cfa5333', v_rand_time);

        -- 3. 写入 website_event 表 (记录这个新访客访问了指定路径)
        INSERT INTO website_event (event_id, website_id, session_id, visit_id, created_at, url_path, event_type)
        VALUES (v_event_id, '49720733-f763-40bd-9d11-fcb88cfa5333', v_session_id, v_visit_id, v_rand_time, '/', 1);
    END LOOP;
END $$;
```

点击 **“执行 (Execute)”**。等待几秒钟，出现绿色成功提示后，返回 Umami 面板刷新即可看到数据已同步更新。

---

## 四、 安全收尾（用完即焚）

为了保证数据库的安全，防止 8080 端口长期暴露在公网被恶意扫描，数据修改完成后，请务必在服务器终端运行以下命令，关闭并删除这个临时的可视化面板：

```bash
docker rm -f umami-adminer
```

*说明：此操作仅会删除临时的可视化面板，绝对不会影响你的 Umami 网站和数据库的正常运行。下次需要修改时，重新执行第一步的开启命令即可。*

