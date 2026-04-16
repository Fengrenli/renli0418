import type { ProjectLocation, ProjectTeamMember } from '../types';

/** 从项目成员解析飞书 open_id（新数据有 feishuOpenId；历史数据 id 为 tm-feishu-{openId}） */
export function getTeamMemberFeishuOpenId(member: ProjectTeamMember): string | null {
  const explicit = String(member.feishuOpenId || '').trim();
  if (explicit) return explicit;
  const id = String(member.id || '');
  if (id.startsWith('tm-feishu-')) {
    const rest = id.slice('tm-feishu-'.length).trim();
    return rest || null;
  }
  return null;
}

export interface FeishuSupportContact {
  openId: string;
  name: string;
  role?: string;
  projectName: string;
}

/** 将 /api/feishu-members-all 返回行转为浮窗列表项（仅组织通讯录，不含项目维度） */
export function mapFeishuApiMembersToSupportContacts(
  rows: { userId?: string; name?: string; jobTitle?: string }[],
): FeishuSupportContact[] {
  const out: FeishuSupportContact[] = [];
  for (const row of rows) {
    const openId = String(row.userId || '').trim();
    if (!openId) continue;
    const roleTrim = (row.jobTitle || '').trim();
    out.push({
      openId,
      name: (row.name || '').trim() || '联系人',
      role: roleTrim || undefined,
      projectName: '',
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

/** 聚合所有项目中、未被排除的飞书成员，供访客从浮窗发起会话 */
export function collectFeishuSupportContacts(projects: ProjectLocation[]): FeishuSupportContact[] {
  const byOpenId = new Map<string, FeishuSupportContact>();
  for (const p of projects) {
    const excluded = new Set(
      (Array.isArray(p.feishuExcludedMemberIds) ? p.feishuExcludedMemberIds : []).map(String),
    );
    const members = Array.isArray(p.teamMembers) ? p.teamMembers : [];
    for (const m of members) {
      const openId = getTeamMemberFeishuOpenId(m);
      if (!openId || excluded.has(openId)) continue;
      const roleTrim = m.role?.trim();
      if (!byOpenId.has(openId)) {
        byOpenId.set(openId, {
          openId,
          name: (m.name || '').trim() || '联系人',
          role: roleTrim,
          projectName: (p.name || '').trim(),
        });
      } else {
        const cur = byOpenId.get(openId)!;
        if (!cur.role && roleTrim) {
          byOpenId.set(openId, { ...cur, role: roleTrim });
        }
      }
    }
  }
  return Array.from(byOpenId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-Hans-CN'),
  );
}

export function feishuP2pChatAppLink(openId: string): string {
  return `https://applink.feishu.cn/client/chat/open?openId=${encodeURIComponent(openId)}`;
}

/**
 * 将「项目已保存的飞书成员」与「飞书租户通讯录 /users 分页结果」合并：
 * - 项目里已有的以项目侧姓名为准，缺职务时用通讯录 jobTitle 补全；
 * - 仅出现在通讯录、未进任何项目 teamMembers 的，也列入（副标题可用 directoryLabel）。
 */
export function mergeProjectContactsWithFeishuDirectory(
  fromProjects: FeishuSupportContact[],
  directoryRows: { userId?: string; name?: string; jobTitle?: string }[],
  directoryLabel: string,
): FeishuSupportContact[] {
  const byOpenId = new Map<string, FeishuSupportContact>();
  for (const c of fromProjects) {
    byOpenId.set(c.openId, { ...c });
  }
  for (const row of directoryRows) {
    const openId = String(row.userId || '').trim();
    if (!openId) continue;
    const nameTrim = (row.name || '').trim();
    const jt = (row.jobTitle || '').trim();
    if (byOpenId.has(openId)) {
      const cur = byOpenId.get(openId)!;
      let next = cur;
      if (!cur.role && jt) next = { ...next, role: jt };
      if (!(cur.name || '').trim() && nameTrim) next = { ...next, name: nameTrim };
      byOpenId.set(openId, next);
    } else {
      byOpenId.set(openId, {
        openId,
        name: nameTrim || '联系人',
        role: jt || undefined,
        projectName: directoryLabel,
      });
    }
  }
  return Array.from(byOpenId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-Hans-CN'),
  );
}
