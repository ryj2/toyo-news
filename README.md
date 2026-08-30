# 東洋新聞 · 日式版式 × 中文新闻源

asahi.com 的版式语言（文字优先、大留白、1px 分隔线、零卡片零阴影、单一强调色 `#b90000`）
+ 各媒体公开 RSS 的真实中文新闻内容。设计对照演示，可直接部署到 Vercel。

## 本地跑

```bash
npm install
npm run probe      # 探测各源在你当前网络下的可达性
npm run dev        # http://localhost:3000
```

## 部署到 Vercel

```bash
vercel login                      # 浏览器里授权一次
cd toyo-news
vercel                            # 首次：建项目，接受默认（Hobby）
vercel env add VERCEL_REGION      # 可跳过，见下「区域」一节
vercel --prod
```

或者用 Git：把本目录推到 GitHub 后在 Vercel 控制台 Import Repository，
`vercel.json` 会被自动读取，不需要额外配置。

### 部署后第一件事：访问 `/api/probe`

```
https://<你的域名>.vercel.app/api/probe
```

它会**在 Vercel 的出口 IP 上**重新探测每个源，返回 `{region, usable, total, results[]}`。
这一步不能省：本机可达 ≠ Vercel 可达，两边的可达集合几乎必然不同。

我 2026-08-29 在你本机实测的结果：

| 源 | 本机 | 说明 |
|---|---|---|
| IT之家 | OK 60 条 | 官方 RSS |
| 开源中国 | OK 50 条 | 官方 RSS |
| 爱范儿 | OK 20 条 | 官方 RSS |
| 澎湃（RSSHub 镜像） | OK 17 条 | `rsshub.rssforever.com`，镜像会抽风 |
| 每经网 | OK 10 条 | 官方 RSS |
| 少数派 | OK 10 条 | 官方 RSS |
| 知乎热榜（镜像） | 时好时坏 | 同一镜像 20 分钟内从 200 变 503 |
| 虎嗅 / 煎蛋 / 36氪 / 联合早报 | FAIL | 超时 / 403 / 返回 HTML 而非 feed |
| BBC中文 / 路透 / 日经中文 | FAIL | 本机不可达，但从 Vercel 境外出口很可能能通 |

**最后一行是关键**：境内不可达的境外源，部署后大概率会变成可用。所以 probe 出来结果和上表
不一样是正常的，按 probe 的实际结果调整 `src/lib/sources.ts` 即可。

## 区域（region）

函数区域已设为 **hkg1（香港）**（2026-08-30 用 `vercel --prod --regions hkg1` 部署生效），
抓国内源的延迟比美东低很多。注意：每次手动部署如果忘了带 `--regions hkg1`，区域会回到项目默认；
可以在 Project Settings → Functions → Function Region 里固定为 hong kong 一劳永逸。

部署后访问 `/api/probe` 在香港出口实测。2026-08-30 实测：12 个源（含镜像）9 个可用；
**BBC中文从香港可达**（本机不通），36氪（feed 为坏 XML）和虎嗅（超时）已从源清单剔除。
知乎热榜主镜像偶发 503，会自动 fallback 到备用镜像。

## 加/减源

只改 `src/lib/sources.ts` 的 `SOURCES` 数组，不用碰其它代码：

```ts
{
  id: 'cailianshe',
  name: '财联社',
  section: 'economy',
  url: 'https://example.com/feed',
  weight: 75,          // 首页左栏优先度
  fallbacks: ['https://mirror.example.com/feed'],  // 主源失败后按顺序尝试
}
```

`section` 只能是 `social | economy | tech | rank`（见 `SECTIONS`）。
抓取失败的源不会让页面崩，会被收集进 `failed`，在首页右栏「取得失败した源」如实列出来。

## 更新节奏

- 数据层：`src/lib/news.ts` 的 `unstable_cache`，TTL 由 `REVALIDATE_SECONDS`（默认 900 秒）控制。
- **秒开机制**：每次成功抓取后会把整份新闻快照存进 Blob（`news/snapshot.json`）；页面渲染优先读快照
  （毫秒级），快照过期就先返回旧数据、用 Next 15 的 `after()` 后台刷新。冷启动首访不再阻塞十秒级。
- HTML：`force-dynamic`，每次请求渲染。**故意不用静态预渲染**——否则「构建时恰好全部源失败」
  的空状态会被永久缓存成一个空壳站。
- Vercel Cron（`vercel.json`，每天 04:00 UTC ≈ 北京时间中午 12 点打 `/api/cron/refresh`）只是**保温**，
  让没人访问时缓存也能刷新。不配它站点照样每 15 分钟自动更新。
  启用时在 Project Settings → Environment Variables 加一个 `CRON_SECRET`，
  路由会自动校验 `Authorization: Bearer`。

  实测限制（2026-08-29 部署时）：**Hobby 计划的 cron 只允许每天一次**，写 `0 * * * *`（每小时）
  会被部署直接拒绝并报
  `Error: Hobby accounts are limited to daily cron jobs`，Pro 计划才解锁高频。
  所以这个保温一天只有一次，别指望它做实时刷新——真正的刷新节奏来自 `unstable_cache` 的 900 秒 TTL。

## 阅读视图与文章存档（混合转载模式）

列表页标题进入本站阅读视图 `/read?u=`：服务端抓取源站页面、抽取正文、清洗后重排为日式版式。
抓取成功后正文会**存档到 Vercel Blob**，之后 24 小时内的访问直接命中存档；源站临时挂掉时
回退展示较早存档（页面会如实标注「本站存档 / 实时重排 / 较早存档」三种状态）。

启用存档只需一步：

1. Vercel 控制台 → 项目 → Storage → Create Database → **Blob**（Hobby 免费额度足够），
   创建时它会自动把 `BLOB_READ_WRITE_TOKEN` 写进项目环境变量；重新部署一次生效。

不配置 token 时存档层整体禁用，站点退回纯实时抓取模式，本地开发零配置可跑。
每日 cron（`/api/cron/refresh`）会把首页前 10 条预抓取并存档，让读者点开基本命中存档。
每篇文章都显著标注「轉載自 <媒体名>」并保留原文链接；白名单域名在 `src/lib/reader.ts`
的 `ALLOWED_ROOTS`，`/read` 与 `/api/img` 都只服务白名单内的源站。

## 内容策略（重要）

本站转载白名单媒体的文章全文用于重排阅读，每篇保留来源署名与原文链接，不做内容修改。
正文的著作权与全部权利归原媒体及原作者所有。如果你要把这个站公开给他人访问，请再确认一遍
目标媒体的服务条款与 robots 策略；多数媒体不接受无授权全文转载，风险自负。

## 配图

列表配图从 RSS 的 enclosure / media:content / 正文首个 `<img>` 提取（`news.ts` 的 `pickImage`），
统一走 `/api/img` 白名单代理 + lazy load；feed 里没有图的源（如开源中国、少数派）保留 CSS 渐变占位块。

## 目录

```
src/lib/sources.ts     源清单与板块定义（唯一需要日常维护的文件）
src/lib/news.ts        抓取、归一化、缓存、摘要截断
src/lib/reader.ts      阅读视图：抓原文、抽正文、清洗、混合存档读取
src/lib/archive.ts     文章存档（Vercel Blob，未配 token 时自动禁用）
src/lib/probe.ts       可达性探测（/api/probe 与 scripts/probe.mjs 共用逻辑）
src/components/chrome.tsx  页头页脚
src/app/page.tsx       首页（三栏：主稿+要点 / 科技+速报 / 排行榜）
src/app/section/[slug]/page.tsx  分类页
src/app/read/page.tsx  阅读视图（日式重排 + 转载署名）
src/app/api/probe/route.ts       源诊断
src/app/api/img/route.ts         白名单图片代理
src/app/api/cron/refresh/route.ts 缓存保温 + 每日预存档
scripts/probe.mjs      命令行探测
```
