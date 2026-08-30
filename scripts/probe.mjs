// 候选新闻源可达性探测。
// 用法：node scripts/probe.mjs            （探测本机出口）
//       部署后访问 /api/probe 可在 Vercel 的区域里跑同一份逻辑
const SOURCES = [
  ['sspai',      'https://sspai.com/feed'],
  ['ifanr',      'https://www.ifanr.com/feed'],
  ['nbd',        'https://www.dtnews.net/feed'],
  ['ithome',     'https://www.ithome.com/rss/'],
  ['huxiu',      'https://www.huxiu.com/rss/0.xml'],
  ['oschina',    'https://www.oschina.net/news/rss'],
  ['jandan',     'https://jandan.net/feed'],
  ['36kr',       'https://36kr.com/feed'],
  ['mirror-thepaper', 'https://rsshub.rssforever.com/thepaper/featured'],
  ['mirror2-thepaper','https://hub.slarker.me/thepaper/featured'],
  ['mirror-zhihu',    'https://rsshub.rssforever.com/zhihu/hot'],
  ['mirror-weibo',    'https://rsshub.rssforever.com/weibo/search/hot'],
  ['mirror-toutiao',  'https://rsshub.rssforever.com/toutiao/hot'],
  ['mirror-netease',  'https://rsshub.rssforever.com/netease/news/rank/whole/click'],
  ['zaobao',     'https://www.zaobao.com.sg/rss'],
  ['bbc-zh',     'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'],
  ['reuters-cn', 'https://www.reuters.com/rssFeed/chineseNews'],
  ['nikkei-cn',  'https://china.nikkei.com.cn/rss.xml'],
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function probeSource(id, url, timeoutMs = 12000) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    const ms = Date.now() - t0;
    const looksXml = /<rss|<feed|<\?xml/i.test(body.slice(0, 400));
    const items = (body.match(/<item[\s>]/g) || []).length + (body.match(/<entry[\s>]/g) || []).length;
    return { id, url, ok: res.ok && looksXml, status: res.status, ms, items, ct: ct.slice(0, 40), bytes: body.length };
  } catch (e) {
    return { id, url, ok: false, status: 0, ms: Date.now() - t0, items: 0, ct: '', bytes: 0, error: e.name + ': ' + e.message };
  }
}

if (process.argv[1] && process.argv[1].endsWith('probe.mjs')) {
  const results = await Promise.all(SOURCES.map(([id, url]) => probeSource(id, url)));
  const w = Math.max(...results.map(r => r.id.length));
  for (const r of results.sort((a, b) => Number(b.ok) - Number(a.ok) || b.items - a.items)) {
    const flag = r.ok ? 'OK  ' : 'FAIL';
    console.log(`${flag} ${r.id.padEnd(w)} ${String(r.status).padStart(3)} ${String(r.ms).padStart(5)}ms ${String(r.items).padStart(3)} items  ${r.error || r.ct}`);
  }
  console.log(`\n可用 ${results.filter(r => r.ok).length} / ${results.length}`);
}
