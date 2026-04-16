/**
 * 构造 Nominatim 检索词序列（与 TerraInk 的「输入地名 → 定位」同源思路）。
 *
 * 顺序要点：
 * 1) 先从项目名/地点中识别常见「中文城市名」，插入明确的西欧城市检索（如 Frankfurt am Main），
 *    再尝试用户填写的 location 与完整店名——避免「品牌+城市+店」整串检索落到错误 POI 或境外重名。
 * 2) 同一城市可对应多家门店；城市级坐标一致是预期行为，不应在应用层按城市去重项目。
 * 3) 再尝试仅国家/地区前缀（中文项目名常见写法）。
 */

const CN_REGION_PREFIXES_SORTED: string[] = [
  '沙特阿拉伯',
  '印度尼西亚',
  '马来西亚',
  '澳大利亚',
  '新西兰',
  '阿联酋',
  '新加坡',
  '菲律宾',
  '柬埔寨',
  '乌兹别克斯坦',
  '哈萨克斯坦',
  '阿塞拜疆',
  '斯洛文尼亚',
  '克罗地亚',
  '塞尔维亚',
  '罗马尼亚',
  '保加利亚',
  '葡萄牙',
  '西班牙',
  '意大利',
  '希腊',
  '瑞士',
  '奥地利',
  '比利时',
  '荷兰',
  '波兰',
  '捷克',
  '匈牙利',
  '乌克兰',
  '白俄罗斯',
  '俄罗斯',
  '土耳其',
  '爱尔兰',
  '冰岛',
  '芬兰',
  '瑞典',
  '挪威',
  '丹麦',
  '斯洛伐克',
  '爱沙尼亚',
  '拉脱维亚',
  '立陶宛',
  '英国',
  '法国',
  '德国',
  '美国',
  '加拿大',
  '墨西哥',
  '巴西',
  '阿根廷',
  '智利',
  '哥伦比亚',
  '秘鲁',
  '南非',
  '埃及',
  '摩洛哥',
  '尼日利亚',
  '日本',
  '韩国',
  '朝鲜',
  '泰国',
  '越南',
  '缅甸',
  '老挝',
  '文莱',
  '东帝汶',
  '印度',
  '巴基斯坦',
  '孟加拉国',
  '斯里兰卡',
  '尼泊尔',
  '香港',
  '澳门',
  '台湾',
  '中国',
  '迪拜',
  '卡塔尔',
  '科威特',
].sort((a, b) => b.length - a.length);

/**
 * 门店名/地点里出现的中文城市称谓 → 优先用语义明确的英文 Nominatim 检索（城市级 centroid）。
 * 须在完整店名、模糊 location 之前尝试，减少误配。
 */
const CHINESE_CITY_HINTS: ReadonlyArray<{
  test: (s: string) => boolean;
  queries: readonly string[];
}> = [
  {
    test: (s) => /法兰克福/.test(s),
    queries: ['Frankfurt am Main, Germany', 'Frankfurt, Hesse, Germany'],
  },
  {
    test: (s) => /慕尼黑/.test(s),
    queries: ['Munich, Bavaria, Germany'],
  },
  {
    test: (s) => /柏林/.test(s),
    queries: ['Berlin, Germany'],
  },
  {
    test: (s) => /杜塞尔多夫|杜塞/.test(s),
    queries: ['Düsseldorf, North Rhine-Westphalia, Germany'],
  },
  {
    test: (s) => /科隆/.test(s),
    queries: ['Cologne, North Rhine-Westphalia, Germany'],
  },
  {
    test: (s) => /斯图加特/.test(s),
    queries: ['Stuttgart, Baden-Württemberg, Germany'],
  },
];

function collectImplicitCityQueries(texts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of texts) {
    const t = String(raw || '').trim();
    if (t.length < 2) continue;
    for (const { test, queries } of CHINESE_CITY_HINTS) {
      if (!test(t)) continue;
      for (const q of queries) {
        if (seen.has(q)) continue;
        seen.add(q);
        out.push(q);
      }
    }
  }
  return out;
}

export function buildGeocodeQueries(params: {
  name?: string;
  location?: string;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t.length < 2) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const loc = String(params.location ?? '').trim();
  const name = String(params.name ?? '').trim();

  const implicit = collectImplicitCityQueries([loc, name]);
  for (const q of implicit) push(q);

  if (loc) push(loc);
  if (name) push(name);

  if (name) {
    for (const pref of CN_REGION_PREFIXES_SORTED) {
      if (name.startsWith(pref) && name.length > pref.length) {
        push(pref);
        break;
      }
    }
  }

  return out;
}
