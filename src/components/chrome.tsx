import { currentEdition, fmtStamp, fmtToday } from '@/lib/news';
import { SECTIONS } from '@/lib/sources';

// 顶部的栏目式入口：速报与热榜有真实落点，其余是版式上的栏目占位
const GNAV: { label: string; href: string; live?: boolean }[] = [
  { label: '速报', href: '/#live', live: true },
  { label: '早报', href: '/#digest' },
  { label: '晚报', href: '/#digest' },
  { label: '专栏', href: '/#main' },
  { label: '热榜', href: '/section/rank' },
];

export function SiteHeader({ active = '首页' }: { active?: string }) {
  const edition = currentEdition();

  return (
    <header className="masthead">
      <div className="masthead__in">
        <div className="masthead__row">
          <a className="logo" href="/">
            東洋新聞
            <small>TOYO SHIMBUN</small>
          </a>
          <nav className="gnav" aria-label="主菜单">
            {GNAV.map((g) => (
              <a key={g.label} href={g.href}>
                {g.label}
                {g.live && <span className="dot" />}
              </a>
            ))}
          </nav>
          <div className="gnav__aside">
            <span className="btn-id">数据来源 · 公开 RSS</span>
          </div>
        </div>
        <p className="masthead__date">
          {fmtToday()} · {edition.name}
          <span>（{edition.note}）</span>
          <i>更新 {fmtStamp(Date.now())}</i>
        </p>
      </div>
      <nav className="nav2" aria-label="板块导航">
        <div className="nav2__in">
          <ul>
            <li>
              <a href="/" className={active === '首页' ? 'is-active' : undefined}>
                首页
              </a>
            </li>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`/section/${s.id}`} className={active === s.label ? 'is-active' : undefined}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter({ note }: { note?: string }) {
  return (
    <footer className="foot">
      <div className="foot__grid">
        <div>
          <h3>新闻板块</h3>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`/section/${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>关于本站</h3>
          <ul>
            <li>
              <a href="/api/probe">源可达性诊断</a>
            </li>
            <li>
              <a href="#disclaim">内容与免责声明</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="foot__bar">
        <span className="foot__logo">東洋新聞</span>
        <span>日式版式 · 中文新闻 · 数据来自各媒体公开 RSS</span>
        <span>© 2026 TOYO SHIMBUN demo</span>
      </div>
      <p className="disclaim" id="disclaim">
        {note ??
          '本站是「日式报纸版式 + 中文新闻内容」的设计对照演示。首页列表仅展示各媒体公开 RSS 中的标题与极短摘要；阅读视图内转载的正文重排自白名单媒体的公开页面，仅去除广告与导航、未作内容修改。转载内容均不代表本站立场与观点，对内容的真实性、准确性、完整性不作任何担保，文责由原新闻源及原作者承担；正文的著作权与全部权利归原媒体及原作者所有，每篇均标注来源并附原文链接，如有侵权请联系删除。'}
      </p>
    </footer>
  );
}
