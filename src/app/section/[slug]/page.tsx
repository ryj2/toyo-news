import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { bySection, fmtStamp, fmtTimeFull, getNewsForRender } from '@/lib/news';
import { SECTIONS, SOURCES, type SectionId } from '@/lib/sources';
import { readHref } from '@/lib/reader';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isSection(v: string): v is SectionId {
  return SECTIONS.some((s) => s.id === v);
}

export default async function SectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSection(slug)) notFound();

  const meta = SECTIONS.find((s) => s.id === slug)!;
  const { items, fetchedAt } = await getNewsForRender();
  const list = bySection(items, slug);
  const sources = SOURCES.filter((s) => s.section === slug);

  return (
    <>
      <SiteHeader active={meta.label} />
      <div className="l-wrap" id="main">
        <div className="col--a">
          <div className="sec__head">
            <h1>{meta.label}</h1>
            <p>
              {meta.sub}　·　来源：{sources.map((s) => s.name).join(' / ') || '—'}
            </p>
          </div>
          <div className="sec__tabs">
            <a href={`/section/${slug}`} className="is-active">
              最新
            </a>
            <a href="/">返回首页</a>
          </div>

          {list.length === 0 && (
            <div className="digest">
              <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                本板块暂无内容。可能是该板块所有源本次都抓取失败，可访问{' '}
                <a href="/api/probe" style={{ textDecoration: 'underline' }}>
                  /api/probe
                </a>{' '}
                检查。
              </p>
            </div>
          )}

          {slug === 'rank' ? (
            <ol className="rank">
              {list.map((it, i) => (
                <li key={it.key}>
                  <span className="rank__no">{i + 1}</span>
                  <div>
                    <p className="rank__t" style={{ fontSize: 15 }}>
                      <a href={readHref(it.url)}>{it.title}</a>
                    </p>
                    {it.snippet && (
                      <p style={{ fontSize: 12.5, color: 'var(--meta)', lineHeight: 1.6, marginTop: 5 }}>{it.snippet}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="list">
              {list.map((it) => (
                <article className="list__item" key={it.key}>
                  <p className="list__label">{it.sourceName}</p>
                  <h2 className="list__t">
                    <a href={readHref(it.url)}>{it.title}</a>
                  </h2>
                  {it.snippet && <p className="list__x">{it.snippet}</p>}
                  <p className="list__meta">
                    <span>{fmtTimeFull(it.time) || '—'}</span>
                    <span>・</span>
                    <span>{it.sourceName}</span>
                  </p>
                  {it.image ? (
                    <a
                      className="ph ph--img"
                      href={readHref(it.url)}
                      style={{ backgroundImage: `url(/api/img?u=${encodeURIComponent(it.image)})` }}
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="ph ph--steel" aria-hidden="true" />
                  )}
                </article>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11.5, color: 'var(--meta-2)', marginTop: 24 }}>
            列表数据抓取自上述媒体的公开 RSS，最后更新 {fmtStamp(fetchedAt)}。标题与摘要的著作权归原媒体所有，本站仅提供索引与跳转。
          </p>
        </div>

        <aside className="rail">
          <div className="rail__block">
            <div className="rank__head">
              <h2>其他板块</h2>
            </div>
            <ul className="more" style={{ marginTop: 10 }}>
              {SECTIONS.filter((s) => s.id !== slug).map((s) => (
                <li key={s.id}>
                  <a href={`/section/${s.id}`}>
                    {s.label}　{s.sub}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <SiteFooter />
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.reload()},900000)' }} />
    </>
  );
}
