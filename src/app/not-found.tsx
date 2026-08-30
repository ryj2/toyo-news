import { SiteFooter, SiteHeader } from '@/components/chrome';
import { SECTIONS } from '@/lib/sources';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <div className="l-wrap" id="main">
        <div className="col--a" style={{ gridColumn: '1 / -1' }}>
          <div className="sec__head">
            <h1>404</h1>
            <p>页面不存在，或板块名称有误</p>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, marginTop: 20 }}>
            可以去 <a href="/" style={{ textDecoration: 'underline' }}>首页</a>，或者直接进某个板块：
          </p>
          <ul className="more" style={{ marginTop: 14 }}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`/section/${s.id}`}>
                  {s.label}　{s.sub}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
