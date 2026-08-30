import { SiteFooter, SiteHeader } from '@/components/chrome';
import { bySection, fmtAgo, fmtStamp, fmtTimeFull, getNewsForRender } from '@/lib/news';
import { SOURCES } from '@/lib/sources';
import { readHref } from '@/lib/reader';
import type { NewsItem } from '@/lib/news';

// HTML 每次请求渲染；抓取结果的 15 分钟缓存 + Blob 快照秒开见 lib/news
export const dynamic = 'force-dynamic';
// 给 after() 的后台刷新留足时间：冷缓存时要同步抓完所有 RSS 源
export const maxDuration = 60;

function Thumb({ it, className }: { it: NewsItem; className: string }) {
  return it.image ? (
    <a
      className={`${className} ${className}--img`}
      href={readHref(it.url)}
      style={{ backgroundImage: `url(/api/img?u=${encodeURIComponent(it.image)})` }}
      aria-hidden="true"
      tabIndex={-1}
    />
  ) : (
    <div className={`${className} ph ph--slate`} aria-hidden="true" />
  );
}

export default async function Home() {
  const { items, failed, fetchedAt } = await getNewsForRender();

  const social = bySection(items, 'social');
  const economy = bySection(items, 'economy');
  const tech = bySection(items, 'tech');
  const zhihu = bySection(items, 'rank');
  // 热榜源是公共镜像，经常 503。留白不如降级：用已抓到的内容按新鲜度排序顶上。
  const rankDegraded = zhihu.length === 0;
  const rank = rankDegraded ? items : zhihu;
  const lead = social[0] ?? items[0];
  const digest = items.slice(0, 3);
  const live = items.slice(0, 10);

  return (
    <>
      <SiteHeader />
      <div className="notice">
        <div className="notice__in">
          最后更新 {fmtStamp(fetchedAt)}（每 15 分钟自动重新抓取）。
          {failed.length > 0 && (
            <>
              {' '}
              <b style={{ color: 'var(--accent)' }}>{failed.length} 个源本次抓取失败</b>
              ，详见页脚诊断链接。
            </>
          )}
        </div>
      </div>

      {/* 速报带：最新十条，相对时间，营造"正在更新"的报纸感 */}
      {live.length > 0 && (
        <div className="strip" id="live">
          <div className="strip__in">
            <span className="strip__label">速报</span>
            <ul>
              {live.map((it) => (
                <li key={it.key}>
                  <span className="strip__time">{fmtAgo(it.time, fetchedAt)}</span>
                  <a href={readHref(it.url)}>{it.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="l-wrap" id="main">
        {!lead ? (
          <div className="col--a" style={{ gridColumn: '1 / -1' }}>
            <div className="digest">
              <h2 style={{ fontSize: 17 }}>本次所有源都没有返回数据</h2>
              <p style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                请先打开 <a href="/api/probe" style={{ textDecoration: 'underline' }}>/api/probe</a>{' '}
                查看 Vercel 出口 IP 对各源的可达性——境外出口被国内站点拒绝是最常见原因。
              </p>
              <ul className="more" style={{ marginTop: 14 }}>
                {failed.map((f) => (
                  <li key={f.id}>
                    <a href="/api/probe">
                      {f.name}：{f.error}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="l-main">
              <div className="col--a">
                <article className="mod mod--lead">
                  <p className="mod__label mod__label--accent">{lead.sourceName}</p>
                  <h1 className="mod__title">
                    <a href={readHref(lead.url)}>{lead.title}</a>
                  </h1>
                  <Thumb it={lead} className="mod__thumb" />
                  <div className="mod__meta">
                    <span>{fmtTimeFull(lead.time) || '—'}</span>
                    <span>・</span>
                    <span>{lead.sourceName}</span>
                    <span>・</span>
                    <a href={lead.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--meta-2)' }}>
                      原文↗
                    </a>
                  </div>
                  {lead.snippet && (
                    <p style={{ gridColumn: 1, fontSize: 13.5, lineHeight: 1.7, color: 'var(--meta)', marginTop: 10 }}>
                      {lead.snippet}
                    </p>
                  )}
                </article>

                <section className="digest" id="digest">
                  <div className="digest__head">
                    <h2>今日三篇 · 要点</h2>
                    <span>各源最新一条自动汇总</span>
                  </div>
                  <ol>
                    {digest.map((it, i) => (
                      <li key={it.key}>
                        <span className="digest__no">{i + 1}</span>
                        <div>
                          <p className="digest__t">
                            <a href={readHref(it.url)}>{it.title}</a>
                          </p>
                          <p className="digest__x">
                            {it.sourceName}
                            {it.snippet ? '　' + it.snippet : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {[...social.slice(1), ...economy].map((it) => (
                  <article className="mod" key={it.key}>
                    <p className="mod__label">{it.sourceName}</p>
                    <h2 className="mod__title">
                      <a href={readHref(it.url)}>{it.title}</a>
                    </h2>
                    <Thumb it={it} className="mod__thumb" />
                    <div className="mod__meta">
                      <span>{fmtTimeFull(it.time) || '—'}</span>
                      <span>・</span>
                      <span>{it.sourceName}</span>
                      <span>・</span>
                      <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--meta-2)' }}>
                        原文↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>

              <div className="col--b">
                {tech.map((it) => (
                  <article className="mod" key={it.key}>
                    <p className="mod__label">{it.sourceName}</p>
                    <h2 className="mod__title mod__title--sm">
                      <a href={readHref(it.url)}>{it.title}</a>
                    </h2>
                    <div className="mod__meta">
                      <span>{fmtTimeFull(it.time) || '—'}</span>
                      <span>・</span>
                      <span>{it.sourceName}</span>
                      <span>・</span>
                      <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--meta-2)' }}>
                        原文↗
                      </a>
                    </div>
                  </article>
                ))}

                <section className="live" style={{ marginTop: 30 }}>
                  <div className="live__head">
                    <h2>最新速报</h2>
                    <a href="/section/tech">各源一览</a>
                  </div>
                  <ul>
                    {live.slice(0, 8).map((it) => (
                      <li key={it.key}>
                        <span className="live__time">
                          {fmtAgo(it.time, fetchedAt)}
                          <b>{it.sourceName.slice(0, 4)}</b>
                        </span>
                        <a href={readHref(it.url)}>{it.title}</a>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            <aside className="rail">
              <div className="rail__block">
                <div className="rank__head">
                  <h2>访问热榜</h2>
                  <span>
                    {rankDegraded ? '各源最新' : '知乎热榜'} · {fmtStamp(fetchedAt)} 更新
                  </span>
                </div>
                <ol className="rank">
                  {rank.slice(0, 15).map((it, i) => (
                    <li key={it.key}>
                      <span className="rank__no">{i + 1}</span>
                      <p className="rank__t">
                        <a href={readHref(it.url)}>{it.title}</a>
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rail__block">
                <div className="kw">
                  <h2>数据来源</h2>
                  <ul>
                    {SOURCES.map((s) => (
                      <li key={s.id}>
                        <a href={`/section/${s.section}`}>{s.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {failed.length > 0 && (
                <div className="rail__block">
                  <div className="rank__head">
                    <h2>本次抓取失败的源</h2>
                  </div>
                  <ul className="more" style={{ marginTop: 10 }}>
                    {failed.map((f) => (
                      <li key={f.id} style={{ fontSize: 12.5 }}>
                        <a href="/api/probe">
                          {f.name} — {f.error.slice(0, 40)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      <SiteFooter />
      {/* 报纸每 15 分钟自动"翻页"：让开着的标签页也能看到最新一期 */}
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.reload()},900000)' }} />
    </>
  );
}
