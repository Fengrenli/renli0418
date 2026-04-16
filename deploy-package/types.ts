
import React from 'react';

export type UserRole = 'admin' | 'guest';

export interface User {
  username: string;
  role: UserRole;
  status?: 'active' | 'pending';
  brand_id?: string;
  brand_name?: string;
}

export interface DigitalAsset {
  id: string;
  type: 'link' | 'qr' | 'rvt' | 'pdf' | 'contract' | 'list' | 'image' | 'video' | 'model';
  name: string;
  url: string;
  size?: string;
  uploadDate: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  budget: string;
  date: string;
  status: 'pending' | 'contacted' | 'rejected' | 'signed';
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface Material {
  id: string;
  code?: string;
  brandId: string;
  materialBrand?: string;
  restaurantBrand?: string;
  restaurantBrandId?: number;
  category: string;
  name: string;
  imageUrl: string;
  image?: string;
  unit: string;
  basePrice: number; // CNY
  price?: number;
  hsCode: string;
  weight: number; // kg per unit
  volume: number; // m3 per unit
  isCustom?: boolean;
  specs?: string;
  spec?: string;
  specsW?: string;
  specsH?: string;
  specsL?: string;
  qty?: number;
  materialArea?: string;
  detailLink?: string;
  area?: string;
  material?: string;
  location?: string;
  boxNo?: string;
  imageFilename?: string;
  /** OSS 短目录名，与 materials_cleaned.pic_folder 一致 */
  pic_folder?: string;
  create_time?: string;
}


export interface CartItem extends Material {
  cartId: string;
  quantity: number;
  packingNo: string;
  selectedSpec?: string;
  selectedArea?: string;
}

export interface ProjectSubStep {
  id: string;
  title: string;
  description: string;
  status: '未开始' | '进行中' | '已完成';
  completedDate?: string;
}

export interface ProjectStage {
  id: string;
  name: string;
  status: '未开始' | '进行中' | '已完成';
  subSteps: ProjectSubStep[];
}

export interface ProjectTeamMember {
  id: string;
  name: string;
  role?: string;
  dept?: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  source?: 'manual' | 'feishu';
  /** 飞书 open_id，用于网页唤起飞书客户端单聊；与 id 前缀 tm-feishu- 二选一即可 */
  feishuOpenId?: string;
}

export interface ProjectLocation {
  id: string;
  name: string;
  location: string;
  description?: string;
  /** 缺省或占位 (0,0) 时不应画地球/地图点，需依赖 geocode 补全 */
  coordinates?: [number, number] | null;
  status: '进行中' | '已完成' | '待启动' | '维护中';
  area?: string;
  workstations?: number;
  contractFile?: string;
  drawingFile?: string;
  completionDate?: string;
  digitalAssets?: DigitalAsset[];
  // New fields for detailed view
  region?: string;
  country?: string;
  city?: string;
  createdAt?: string;
  create_time?: string;
  imageUrl?: string;
  progress?: number; // 0-100
  stages?: ProjectStage[];
  clientName?: string;
  /** 与登录用户 brand_id 对应，用于多品牌筛选 */
  brandId?: string;
  projectType?: string;
  feishuDeptId?: string; // 绑定的飞书部门ID（open_department_id）
  teamMembers?: ProjectTeamMember[];
  feishuExcludedMemberIds?: string[];
}

