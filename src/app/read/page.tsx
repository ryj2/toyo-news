import { SiteFooter, SiteHeader } from '@/components/chrome';
import { readArticleWithArchive, ReadMode } from '@/lib/reader';
import { fmtStamp } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const metadata = { title: '阅读 · 東洋新聞' };

const MODE_LABEL: Record<ReadMode, string> = {
  live: '实时重排',
  archive: '本站存档',
  stale: '较早存档',
};

export default async function ReadPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const art = await readArticleWithArchive(u ?? '');

  return (
    <>
      <SiteHeader />
      <div className="l-wrap" style={{ display: 'block', paddingTop: 0 }}>
        <div className="art">
          <div className="art__main">
            <p className="crumb">
              <a href="/">首页</a> › <b>阅读</b>
            </p>

            {!art.ok ? (
              <div className="digest">
                <h2 style={{ fontSize: 17, marginBottom: 10 }}>本文を取得できませんでした</h2>
                <p style={{ fontSize: 14, lineHeight: 1.8 }}>
                  原因：{art.reason}
                  <br />
                  目标地址：<span style={{ wordBreak: 'break-all' }}>{art.url || '—'}</span>
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--meta)', marginTop: 12 }}>
                  阅读模式是服务端实时抓取源站页面、抽取正文后重排显示。抽取失败通常有三种情况：
                  页面完全由 JavaScript 渲染、目标域名不在源站白名单内、或本站出口 IP 被源站拒绝。
                  可以点下面的原文链接直接看源站。
                </p>
                {art.url && (
                  <p className="more" style={{ marginTop: 14 }}>
                    <a href={art.url} target="_blank" rel="noopener noreferrer nofollow">
                      在源站打开原文
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="art__label">
                  转载自 <b>{art.siteName || art.host}</b>
                  <span className="art__mode">{MODE_LABEL[art.mode]}</span>
                </p>
                <h1 className="art__title">{art.title}</h1>

                <div className="art__byline">
                  {art.byline && <span className="art__author">{art.byline}</span>}
                  <span>{art.publishedAt ? art.publishedAt.replace('T', ' ').slice(0, 16) : '发布时间未知'}</span>
                  <span>・</span>
                  <span>约 {art.words} 字</span>
                  <span className="art__tools">
                    <a className="btn-id" href={art.url} target="_blank" rel="noopener noreferrer nofollow">
                      阅读原文
                    </a>
                  </span>
                </div>

                <p className="renotice">
                  本文转载自 <b>{art.siteName || art.host}</b>
                  {' '}（<a href={art.url} target="_blank" rel="noopener noreferrer nofollow">查看原文</a>），
                  由本站抓取公开页面并重排为日式版式显示，仅去除广告与导航，未作内容修改。
                  正文的著作权与全部权利归 {art.siteName || art.host} 及原作者所有。
                  {art.mode === 'archive' && <>以下为本站于 {fmtStamp(art.fetchedAt)} 抓取的存档版本。</>}
                  {art.mode === 'stale' && (
                    <>
                      源站暂时无法访问，以下为本站 {fmtStamp(art.fetchedAt)} 抓取的较早存档；
                      建议通过上方链接到源站阅读最新版本。
                    </>
                  )}
                  {art.mode === 'live' && <>抓取时间 {fmtStamp(art.fetchedAt)}。</>}
                </p>

                {art.excerpt && <p className="sub">{art.excerpt}</p>}

                <article className="art__body prose" dangerouslySetInnerHTML={{ __html: art.html }} />

                <p className="art__end">
                  <a href={art.url} target="_blank" rel="noopener noreferrer nofollow">
                    ▲ 阅读原文 / 举报转载问题
                  </a>
                  <span style={{ marginLeft: 14 }}>·</span>
                  <span style={{ marginLeft: 14 }}>
                    <a href="/">返回首页</a>
                  </span>
                </p>
              </>
            )}
          </div>

          <aside className="rail art__rail">
              <div className="rail__block">
                <div className="rank__head">
                  <h2>阅读说明</h2>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--meta)', marginTop: 12 }}>
                  首页与板块页的标题默认进入本站阅读视图；每条都同时保留了跳转源站的「阅读原文」链接。
                </p>
              </div>
              <div className="rail__block">
                <div className="kw">
                  <h2>允许转载的源站</h2>
                  <ul>
                    {['thepaper.cn', 'ithome.com', 'oschina.net', 'ifanr.com', 'sspai.com', 'dtnews.net', 'nbd.com.cn', 'zhihu.com', 'bbc.com', '36kr.com', 'huxiu.com'].map(
                      (h) => (
                        <li key={h}>
                          <span style={{ cursor: 'default' }}>{h}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
          </aside>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
