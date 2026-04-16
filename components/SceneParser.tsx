/**
 * 🎬 SceneParser — Pascal 场景 JSON → R3F 3D 渲染引擎
 *
 * 职责：
 * 1. 读取 Zustand sceneConfig，遍历所有构件节点
 * 2. 为每个节点渲染对应的 ArchitectureNode
 * 3. 管理 3D 场景的灯光、地面、摄像机
 * 4. 提供示例场景加载功能（用于演示和测试）
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Grid, ContactShadows, PerspectiveCamera, useProgress, Html } from '@react-three/drei';
import * as THREE from 'three';

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
  // === 核心建筑主体 ===
  {
    id: 'main-structure',
    sku: 'WD08-GYHG-X324-001',
    name: '小龙坎古建门店 (祠堂主体)',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    modelUrl: '/models/citang.glb',
    category: 'structure',
    quantity: 1
  },
  // === 关键算量构件 (代表性展示) ===
  {
    id: 'column-group',
    sku: 'WD08-GYHG-X7BA-001',
    name: '红木支撑柱',
    position: [0, 0, 0],
    category: 'structure',
    quantity: 12,
    length: 3.5
  },
  {
    id: 'roof-tiles-main',
    sku: 'BR99-GYHG-ABETH-001',
    name: '筒瓦 (深灰色)',
    position: [0, 0, 0],
    category: 'eaves',
    quantity: 2850,
    area: 142
  },
  {
    id: 'brick-wall-main',
    sku: 'BR99-GYHG-ABMRR-002',
    name: '古建青砖墙板',
    position: [0, 0, 0],
    category: 'wall',
    area: 96
  },
  {
    id: 'bracket-set',
    sku: 'WD08-GYHG-X324-002',
    name: '木作雀替 (精雕)',
    position: [0, 0, 0],
    category: 'decoration',
    quantity: 24
  },
  {
    id: 'plaque-main',
    sku: 'WD08-GYHG-X7BA-002',
    name: '实木匾额 (金漆)',
    position: [0, 3.5, 0],
    category: 'decoration',
    quantity: 1
  }
];

// ─── Fly-To 相机控制器 ───
function FlyToController() {
  const cameraControlsRef = useRef<any>(null);
  const selectedSku = useEngineeringStore((s) => s.selectedSku);
  const sceneConfig = useEngineeringStore((s) => s.sceneConfig);
  const setCameraAnimating = useEngineeringStore((s) => s.setCameraAnimating);
  const { scene } = useThree();

  useEffect(() => {
    if (!selectedSku || !cameraControlsRef.current) return;
    
    // 找到所有匹配 SKU 的节点
    const matchingNodes = sceneConfig.filter((n) => n.sku === selectedSku);
    if (matchingNodes.length === 0) return;

    // 计算所有匹配节点的包围盒中心
    const box = new THREE.Box3();
    matchingNodes.forEach((node) => {
      const point = new THREE.Vector3(...node.position);
      box.expandByPoint(point);
    });
    // 扩展包围盒使相机不要贴太近
    box.expandByScalar(1.5);

    const center = new THREE.Vector3();
    box.getCenter(center);

    const controls = cameraControlsRef.current;
    setCameraAnimating(true);

    // 计算合适的相机距离
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = Math.max(maxDim * 2.5, 4);

    // 从斜上方飞入
    const camPos = center.clone().add(new THREE.Vector3(distance * 0.6, distance * 0.5, distance * 0.6));

    controls.setLookAt(
      camPos.x, camPos.y, camPos.z,
      center.x, center.y, center.z,
      true // 平滑过渡
    ).then(() => {
      setCameraAnimating(false);
    });
  }, [selectedSku, sceneConfig, setCameraAnimating, scene]);

  return (
    <CameraControls
      ref={cameraControlsRef}
      makeDefault
      minDistance={2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.1}
      smoothTime={0.35}
      draggingSmoothTime={0.15}
    />
  );
}

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

      {/* 环境光照补充 */}
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

      {/* 相机控制器 + Fly-To */}
      <FlyToController />
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
