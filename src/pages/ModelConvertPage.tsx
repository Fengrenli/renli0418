import React from 'react';
import SKPToGLBConverter from '../components/SKPToGLBConverter';

const ModelConvertPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            3D 模型格式转换工具
          </h2>
          <p className="text-gray-600">
            在线将 SketchUp (.skp) 转换为可在网页直接预览的 .glb 模型
          </p>
        </div>

        {/* 核心转换组件 */}
        <SKPToGLBConverter />

        {/* 底部说明 */}
        <div className="mt-10 text-sm text-gray-500 bg-gray-100 p-4 rounded-lg">
          <p className="font-medium mb-1">使用说明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>仅支持 SketchUp 2015–2020 版本的 .skp 文件</li>
            <li>转换全程在浏览器内进行，不上传文件到服务器</li>
            <li>自动校正坐标系 Z 轴 → Y 轴</li>
            <li>自动将纹理嵌入模型，保证文件完整可下载</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ModelConvertPage;