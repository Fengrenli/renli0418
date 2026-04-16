import React, { useState } from 'react';

const SKPToGLBConverter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFile, setConvertedFile] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.skp')) {
        setFile(selectedFile);
        setError(null);
        setConvertedFile(null);
      } else {
        setError('请选择 .skp 格式的文件');
        setFile(null);
        setConvertedFile(null);
      }
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setError(null);

    try {
      // 模拟转换过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟转换结果
      const mockGlbFile = new Blob(['mock glb data'], { type: 'model/gltf-binary' });
      setConvertedFile(mockGlbFile);
    } catch (err) {
      setError('转换失败，请重试');
      console.error('转换错误:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedFile) return;
    
    const url = URL.createObjectURL(convertedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = file?.name.replace('.skp', '.glb') || 'converted.glb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择 SketchUp 文件 (.skp)
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept=".skp"
            onChange={handleFileChange}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleConvert}
            disabled={!file || isConverting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConverting ? '转换中...' : '开始转换'}
          </button>
        </div>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        {file && <p className="mt-2 text-sm text-gray-600">已选择: {file.name}</p>}
      </div>

      {convertedFile && (
        <div className="mt-6 p-4 bg-green-50 rounded-md">
          <h3 className="font-medium text-green-800 mb-2">转换成功！</h3>
          <p className="text-sm text-green-700 mb-4">
            文件已成功转换为 GLB 格式
          </p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            下载 GLB 文件
          </button>
        </div>
      )}
    </div>
  );
};

export default SKPToGLBConverter;