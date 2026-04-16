/**
 * 🧱 ArchitectureNode — 单个古建构件的 R3F 3D 渲染组件
 *
 * 职责：
 * 1. 根据 SceneNode 配置，加载对应的 GLB 模型或渲染占位几何体
 * 2. 响应点击事件，更新 Zustand selectedSku
 * 3. 当被选中 / 高亮时，渲染发光轮廓线（Highlight Pulse）
 */

import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';

// 设置 Draco 解码器路径以加速模型加载
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');

import * as THREE from 'three';
import { useEngineeringStore, type SceneNode } from '../store/useEngineeringStore';

// ─── SKU → 默认颜色映射（按材料类别区分） ───
const CATEGORY_COLORS: Record<string, string> = {
  eaves: '#8B4513',    // 屋檐 - 深棕色
  wall: '#A0522D',     // 墙面 - 赭石色
  structure: '#D2691E', // 结构 - 巧克力色
  decoration: '#CD853F',// 装饰 - 秘鲁色
  default: '#B8860B',  // 默认 - 暗金色
};

// ─── 根据 SKU 编码推断几何体形状 ───
function inferGeometry(sku: string, name?: string): THREE.BufferGeometry {
  const lower = (name || sku).toLowerCase();
  let geo: THREE.BufferGeometry;

  if (lower.includes('瓦') || lower.includes('tile') || lower.includes('abeth') || lower.includes('x8d5')) {
    // 瓦片 → 扁平弧面（用薄长方体近似）
    geo = new THREE.BoxGeometry(0.3, 0.02, 0.2);
    geo.translate(0, 0.01, 0); // 基准在底部
  } else if (lower.includes('脊') || lower.includes('ridge') || lower.includes('abhrg')) {
    // 脊 → 半圆柱（用圆柱近似）
    geo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    geo.translate(0, 0.6, 0); // 基准在底部
  } else if (lower.includes('砖') || lower.includes('brick') || lower.includes('abmrr')) {
    // 砖 → 标准长方体
    geo = new THREE.BoxGeometry(0.24, 0.06, 0.12);
    geo.translate(0, 0.03, 0); // 基准在底部
  } else if (lower.includes('柱') || lower.includes('column') || lower.includes('pillar')) {
    // 柱 → 圆柱
    geo = new THREE.CylinderGeometry(0.15, 0.18, 3.0, 12);
    geo.translate(0, 1.5, 0); // 基准在底部
  } else if (lower.includes('梁') || lower.includes('beam')) {
    // 梁 → 长方体
    geo = new THREE.BoxGeometry(0.2, 0.3, 2.5);
    geo.translate(0, 0.15, 0); // 基准在底部
  } else if (lower.includes('滴水') || lower.includes('abtie')) {
    // 滴水 → 小三角（用锥体近似）
    geo = new THREE.ConeGeometry(0.06, 0.1, 4);
    geo.translate(0, 0.05, 0); // 基准在底部
  } else if (lower.includes('猫头') || lower.includes('abmao')) {
    // 猫头 → 小球
    geo = new THREE.SphereGeometry(0.08, 8, 8);
    geo.translate(0, 0.08, 0); // 基准在底部
  } else {
    // 默认 → 立方体
    geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    geo.translate(0, 0.15, 0); // 基准在底部
  }

  // 确保有 groups 防止 raycast materialIndex 崩溃
  if (geo.groups.length === 0) {
    geo.addGroup(0, geo.index ? geo.index.count : (geo.attributes.position?.count || 0), 0);
  }
  return geo;
}

// ─── GLB 模型加载子组件 ───
function GlbModel({ url, isSelected }: { url: string; isSelected: boolean }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={cloned}
      scale={1}
    />
  );
}

// ─── 主组件 ─────────────────────────────────────
interface ArchitectureNodeProps {
  node: SceneNode;
}

const ArchitectureNode: React.FC<ArchitectureNodeProps> = ({ node }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const selectedSku = useEngineeringStore((s) => s.selectedSku);
  const selectedNodeId = useEngineeringStore((s) => s.selectedNodeId);
  const highlightPulse = useEngineeringStore((s) => s.highlightPulse);
  const selectSku = useEngineeringStore((s) => s.selectSku);

  const isSelected = selectedNodeId === node.id || (selectedSku === node.sku && !selectedNodeId);
  const isPulsing = highlightPulse?.sku === node.sku;
  // X-Ray: 有选中 SKU 但不是当前构件 → 降低透明度
  const isXRay = !!selectedSku && !isSelected && !isPulsing;

  // 推断颜色
  const baseColor = useMemo(() => {
    if (node.color) return node.color;
    return CATEGORY_COLORS[node.category || 'default'] || CATEGORY_COLORS.default;
  }, [node.color, node.category]);

  // 动态材质
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
  }, [baseColor]);

  // 占位几何体
  const geometry = useMemo(() => {
    return inferGeometry(node.sku, node.name);
  }, [node.sku, node.name]);

  // 动画帧：选中/高亮时的脉冲发光
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    if (isSelected || isPulsing) {
      // 脉冲缩放效果
      const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.03;
      mesh.scale.setScalar(pulse);
      (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#E1251B');
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.008) * 0.2;
    } else if (hovered) {
      mesh.scale.setScalar(1.02);
      (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#ff8800');
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    } else {
      mesh.scale.setScalar(1);
      (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#000000');
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
    // X-Ray 透明度：有选中构件时，未选中的逐渐变透明
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const targetOpacity = isXRay ? 0.2 : 1;
    mat.opacity += (targetOpacity - mat.opacity) * Math.min(delta * 6, 1);
    mat.transparent = mat.opacity < 0.99;
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    // 切换选中：再次点击同一个则取消
    if (selectedNodeId === node.id) {
      selectSku(null, null);
    } else {
      selectSku(node.sku, node.id);
    }
  };

  return (
    <group
      position={node.position}
      rotation={node.rotation || [0, 0, 0]}
      scale={node.scale || [1, 1, 1]}
    >
      {node.modelUrl ? (
        // 有 GLB 模型 → 加载真实模型
        <React.Suspense fallback={
          <mesh ref={meshRef} geometry={geometry} material={material}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          />
        }>
          <group onClick={handleClick} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
            <GlbModel url={node.modelUrl} isSelected={isSelected} />
          </group>
        </React.Suspense>
      ) : (
        // 无模型 → 渲染推断的占位几何体
        <mesh
          ref={meshRef}
          geometry={geometry}
          material={material}
          onClick={handleClick}
          onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
          castShadow
          receiveShadow
        />
      )}

      {/* 选中时显示浮动标签 */}
      {isSelected && (
        <Html
          position={[0, 0.5, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap shadow-xl border border-white/10">
            <div className="font-black uppercase tracking-wider">{node.name || node.sku}</div>
            {node.area && <div className="text-white/60 mt-0.5">面积: {node.area}㎡</div>}
            {node.length && <div className="text-white/60 mt-0.5">长度: {node.length}m</div>}
          </div>
        </Html>
      )}
    </group>
  );
};

export default React.memo(ArchitectureNode);
