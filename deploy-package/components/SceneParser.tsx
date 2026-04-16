/**
 * 🎬 SceneParser — Pascal 场景 JSON → R3F 3D 渲染引擎
 *
 * 职责：
 * 1. 读取 Zustand sceneConfig，遍历所有构件节点
 * 2. 为每个节点渲染对应的 ArchitectureNode
 * 3. 管理 3D 场景的灯光、地面、摄像机
 * 4. 提供示例场景加载功能（用于演示和测试）
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, PerspectiveCamera, useProgress, Html } from '@react-three/drei';

// ─── 加载进度组件 ───
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-100/60 shadow-2xl">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle className="text-gray-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
            <circle className="text-red-500 transition-all duration-300" strokeWidth="8" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progress) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-900">
            {Math.round(progress)}%
          </div>
        </div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          载入 3D 算量引擎...
        </div>
      </div>
    </Html>
  );
}
import { useEngineeringStore, type SceneNode } from '../store/useEngineeringStore';
import ArchitectureNode from './ArchitectureNode';

// ─── 示例场景：小龙坎古建门店（用于演示） ───
export const DEMO_SCENE: SceneNode[] = [
  // === 屋顶瓦片层 ===
  // 正脊（屋顶最高处横梁）
  { id: 'ridge-1', sku: 'BR99-GYHG-ABHRG-001', name: '正脊(三星脊)', position: [0, 4.2, 0], rotation: [0, 0, 0], scale: [8, 1, 1], category: 'eaves', length: 8 },

  // 筒瓦排列（左坡）
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `tube-tile-L-${i}`, sku: 'BR99-GYHG-ABETH-001', name: '筒瓦',
    position: [-1.5 + i * 0.6, 3.5 - i * 0.15, -1.5] as [number, number, number],
    rotation: [0.3, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    category: 'eaves', length: 3,
  })),
  // 筒瓦排列（右坡）
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `tube-tile-R-${i}`, sku: 'BR99-GYHG-ABETH-001', name: '筒瓦',
    position: [-1.5 + i * 0.6, 3.5 - i * 0.15, 1.5] as [number, number, number],
    rotation: [-0.3, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    category: 'eaves', length: 3,
  })),

  // 板瓦（铺在筒瓦之间）
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `flat-tile-L-${i}`, sku: 'BR99-GYHG-X8D5-001', name: '板瓦(普通瓦片)',
    position: [-1.2 + i * 0.6, 3.4 - i * 0.15, -1.2] as [number, number, number],
    rotation: [0.3, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    category: 'eaves', length: 3,
  })),

  // 滴水（檐口下方）
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `drip-${i}`, sku: 'BR99-GYHG-ABTIE-001', name: '滴水',
    position: [-1 + i * 0.7, 2.8, -2.2] as [number, number, number],
    category: 'eaves', length: 2,
  })),

  // 瓦当（檐口装饰）
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `wadang-${i}`, sku: 'BR99-GYHG-ABETH-002', name: '瓦当-筒瓦瓦当',
    position: [-1 + i * 0.7, 2.9, -2.3] as [number, number, number],
    category: 'eaves', length: 2,
  })),

  // 猫头
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `cat-head-${i}`, sku: 'BR99-GYHG-ABMAO-001', name: '猫头',
    position: [-0.7 + i * 0.7, 3.0, -2.4] as [number, number, number],
    category: 'eaves', length: 2,
  })),

  // === 墙面 ===
  // 预制青砖墙板（主墙面）
  ...Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => ({
      id: `wall-panel-${row}-${col}`, sku: 'BR99-GYHG-ABMRR-002', name: '预制工字拼青砖墙板',
      position: [-1.5 + col * 1.0, 0.5 + row * 0.8, -2.5] as [number, number, number],
      scale: [1.3, 1, 1] as [number, number, number],
      category: 'wall', area: 0.702,
    }))
  ).flat(),

  // 旧青砖片（收口用）
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `brick-trim-${i}`, sku: 'BR99-GYHG-ABMRR-001', name: '旧青砖片',
    position: [-1.2 + i * 0.5, 0.1, -2.5] as [number, number, number],
    category: 'wall', area: 0.03,
  })),
];

// ─── 3D 场景内部渲染器 ───
function SceneContent() {
  const sceneConfig = useEngineeringStore((s) => s.sceneConfig);
  const selectSku = useEngineeringStore((s) => s.selectSku);

  // 点击空白处取消选中
  const handlePointerMissed = useCallback(() => {
    selectSku(null, null);
  }, [selectSku]);

  return (
    <>
      {/* 摄像机 */}
      <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={45} />

      {/* 环境光照 */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />

      {/* 环境光照补充（移除 Environment preset 避免 HDR 加载超时） */}
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.6]} />

      {/* 地面网格 */}
      <Grid
        args={[30, 30]}
        position={[0, -0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#d4d4d8"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#a1a1aa"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />

      {/* 接触阴影 */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.25}
        scale={20}
        blur={2}
        far={4}
      />

      {/* 渲染所有场景节点 */}
      <group onPointerMissed={handlePointerMissed}>
        {sceneConfig.map((node) => (
          <ArchitectureNode key={node.id} node={node} />
        ))}
      </group>

      {/* 轨道控制器 */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 2, 0]}
      />
    </>
  );
}

// ─── 主组件：带 Canvas 的完整 3D 场景 ───
interface SceneParserProps {
  /** 外部传入场景数据（可选，不传则使用 Store 中的） */
  initialScene?: SceneNode[];
  /** Canvas 容器样式 */
  className?: string;
  /** 是否显示性能监控 */
  showStats?: boolean;
}

const SceneParser: React.FC<SceneParserProps> = ({
  initialScene,
  className = 'w-full h-full',
  showStats = false,
}) => {
  const loadScene = useEngineeringStore((s) => s.loadScene);
  const sceneConfig = useEngineeringStore((s) => s.sceneConfig);

  // 如果传入了初始场景且 Store 为空，则加载
  useEffect(() => {
    if (initialScene && sceneConfig.length === 0) {
      loadScene(initialScene);
    }
  }, [initialScene, sceneConfig.length, loadScene]);

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: 3, // ACESFilmicToneMapping
          toneMappingExposure: 1.0,
        }}
        style={{ background: 'linear-gradient(180deg, #e8e8ed 0%, #f5f5f7 50%, #fafafa 100%)' }}
      >
        <React.Suspense fallback={<Loader />}>
          <SceneContent />
        </React.Suspense>
      </Canvas>
    </div>
  );
};

export default React.memo(SceneParser);
