# 東洋新聞 · toyo-news

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ryj2/toyo-news)

一个用 **asahi.com 式日式报纸版式**呈现**中文新闻**的聚合站。文字优先、大留白、1px 分隔线、零卡片零阴影、单一强调色 `#b90000`——让刷 feed 变成读报。

**在线演示**：[news.01101.top](https://news.01101.top/)


## 它是什么样的

- **首页是一份"今天的报纸"**：报头带日期与朝刊/晚报标识、横向速报带（"3分钟前"）、红色肩题标注来源媒体、头条大图、编辑精选"今日三篇"、访问热榜。
- **点开标题进入阅读视图**：服务端抓取源站原文，抽取正文，去除广告与导航后以同样的日式版式重排展示；每篇显著标注「转载自〈媒体名〉」并附原文链接。
- **混合转载模式**：抓取成功后正文存档到 Vercel Blob，24 小时内的访问直接命中存档；源站临时不可用时回退较早存档（页面会如实标注三种状态：本站存档 / 实时重排 / 较早存档）。

## 特性

- 📰 asahi.com 版式语言：明朝体标题、黑体正文、单一强调色、零阴影
- 🖼️ RSS 配图自动提取（enclosure / media:content / 正文首图），统一走白名单图片代理，防盗链
- ⚡ 快照秒开：新闻快照存 Vercel Blob，先渲染后刷新（Next 15 `after()`），冷启动首访不再等十几秒
- 🗄️ 文章存档：全文 JSON 存 Blob，源站挂了也能读（诚实标注是较早存档）
- 🩺 源可达性探测：`/api/probe` 在部署环境的出口 IP 上实测每个源，页脚如实展示失败的源
- ⏰ Vercel Cron 每日保温 + 预存档前 10 条

## 技术栈

Next.js 15（App Router）· React 19 · TypeScript · rss-parser · jsdom + Readability · Vercel Blob。无数据库、无 UI 库，样式为单文件手写 CSS（复刻 asahi 版式）。

```
RSS 源 ──15min 缓存──▶ 快照(Blob) ──▶ 首页/板块页（标题+摘要+配图）
                          │
标题点击 ──▶ /read?u=… ──▶ 存档命中？──是──▶ 日式重排展示
                          │否
                          ▼
              抓源站 HTML → Readability 抽正文 → 清洗/图片改写
                          │成功
                          ▼
                 写入 Blob 存档（双 key：入口 URL + 最终 URL）
```

## 本地运行

```bash
npm install
npm run probe      # 探测各 RSS 源在你当前网络下的可达性
npm run dev        # http://localhost:3000
```

未配置 Vercel Blob 时存档/快照功能自动禁用，站点退回纯实时抓取模式——本地零配置即可跑通。

## 部署到 Vercel

点上面的 **Deploy** 按钮，或手动：

```bash
vercel login
vercel                                    # 建项目
vercel --prod --regions hkg1              # 香港区域，抓国内源延迟低
```

部署后三件事：

1. **接通 Blob**：Project → Storage → Create Database → Blob。新版控制台会自动注入
   `BLOB_STORE_ID`（免 token 模式）；如果只拿到 `BLOB_READ_WRITE_TOKEN` 也一样，二者任一存在即启用存档。
2. **固定区域**：Project Settings → Functions → Function Region 改为 Hong Kong
   （否则每次 CLI 部署要带 `--regions hkg1`）。
3. **验证源**：访问 `/api/probe`，在你部署区域的出口 IP 上实测各源可达性——本机可达 ≠ Vercel 可达，
   按实测结果增删 `src/lib/sources.ts`。

### 加/减新闻源

只改 `src/lib/sources.ts` 的 `SOURCES` 数组：

```ts
{
  id: 'example',          // 唯一 id
  name: '示例媒体',        // 页面署名，必须真实
  section: 'social',      // social | economy | tech | rank
  url: 'https://example.com/rss',
  weight: 60,             // 首页排序权重
  fallbacks: ['https://mirror.example.com/rss'],  // 主源失败时的备用镜像
}
```

同时把媒体域名加进 `src/lib/reader.ts` 的 `ALLOWED_ROOTS` 白名单（`/read` 与 `/api/img` 只服务白名单内域名，这是刻意的安全边界：没有白名单它们就是任意代理）。

## 目录结构

```
src/lib/sources.ts     源清单与板块定义（唯一需要日常维护的文件）
src/lib/news.ts        RSS 抓取、配图提取、快照秒开、时间格式化
src/lib/reader.ts      阅读视图：抓原文、抽正文、清洗、混合存档读取
src/lib/archive.ts     Blob 存档层（文章存档 + 新闻快照，未接通时自动禁用）
src/lib/probe.ts       可达性探测（/api/probe 与命令行共用）
src/app/page.tsx       首页（速报带 / 头条 / 今日三篇 / 栏目 / 热榜）
src/app/section/[slug] 板块页
src/app/read           阅读视图（日式重排 + 转载署名 + 存档状态）
src/app/api/img        白名单图片代理
src/app/api/probe      源诊断
src/app/api/cron       每日保温 + 预存档（vercel.json 已配置，Hobby 仅支持每日一次）
```

## 内容与版权（重要）

- 本仓库的**代码**以 MIT 协议开源，欢迎自由使用与修改。
- 站点转载的**文章内容**不属于本仓库：正文著作权与全部权利归原媒体及原作者所有，每篇均标注来源并附原文链接。多数媒体不接受无授权全文转载，**公开运营前请自行确认目标媒体的服务条款与 robots 策略**；用于个人阅读与设计对照则风险很低。
- 阅读视图只服务 `ALLOWED_ROOTS` 白名单内的媒体域名，图片经代理防盗链，列表页仅展示标题与极短摘要。

## 免责声明

1. 本站为新闻聚合与版式演示项目，**所转载内容均不代表本站立场与观点**。
2. 转载内容来自公开媒体的 RSS 或公开页面，本站仅作版式重排，不修改原文；对内容的**真实性、准确性、完整性、时效性不作任何担保**。
3. 相关文章的**文责由原新闻源及原作者承担**；如认为本站转载侵犯了您的合法权益，请通过 Issue 联系，核实后将在 24 小时内删除或断开相关内容。
4. 本站提供的原文链接仅为便于溯源，点击后跳转至第三方站点，其内容与本站无关。

## 相关链接

- [linux.do](https://linux.do) — 理想的技术社区

## License

[MIT](LICENSE)
