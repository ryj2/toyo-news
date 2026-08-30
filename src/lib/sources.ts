export type SectionId = 'social' | 'economy' | 'tech' | 'rank';

export interface SectionDef {
  id: SectionId;
  /** 导航与页面上显示的板块名（中文） */
  label: string;
  /** 补充说明 */
  sub: string;
}

export const SECTIONS: SectionDef[] = [
  { id: 'social', label: '社会', sub: '社会·时局' },
  { id: 'economy', label: '经济', sub: '经济·市场' },
  { id: 'tech', label: 'IT·科学', sub: '科技·数码' },
  { id: 'rank', label: '热榜', sub: '全网热议' },
];

export interface SourceDef {
  id: string;
  /** 页面上显示的原媒体名，必须署名 */
  name: string;
  section: SectionId;
  url: string;
  /** 首页左栏优先度，越大越靠前 */
  weight: number;
  /** 备用镜像：主源失败时按顺序尝试 */
  fallbacks?: string[];
}

// 2026-08-29 实测记录。部署到香港区域后请再访问 /api/probe 复核：
// 出口 IP 变了，可达集合会不一样；打不开的源直接从下面删掉即可。
export const SOURCES: SourceDef[] = [
  {
    id: 'thepaper',
    name: '澎湃新闻',
    section: 'social',
    url: 'https://rsshub.rssforever.com/thepaper/featured',
    weight: 90,
    fallbacks: ['https://hub.slarker.me/thepaper/featured'],
  },
  {
    id: 'bbczh',
    name: 'BBC中文',
    section: 'social',
    url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
    weight: 75,
  },
  {
    id: 'nbd',
    name: '每日经济新闻',
    section: 'economy',
    url: 'https://www.dtnews.net/feed',
    weight: 80,
  },
  {
    id: 'ithome',
    name: 'IT之家',
    section: 'tech',
    url: 'https://www.ithome.com/rss/',
    weight: 70,
  },
  {
    id: 'oschina',
    name: '开源中国',
    section: 'tech',
    url: 'https://www.oschina.net/news/rss',
    weight: 55,
  },
  {
    id: 'ifanr',
    name: '爱范儿',
    section: 'tech',
    url: 'https://www.ifanr.com/feed',
    weight: 60,
  },
  {
    id: 'sspai',
    name: '少数派',
    section: 'tech',
    url: 'https://sspai.com/feed',
    weight: 50,
  },
  {
    id: 'zhihu',
    name: '知乎热榜',
    section: 'rank',
    url: 'https://rsshub.rssforever.com/zhihu/hot',
    weight: 100,
    fallbacks: ['https://hub.slarker.me/zhihu/hot'],
  },
];

export const REVALIDATE_SECONDS = 900;
