import React, { memo } from 'react';
import '@google/model-viewer';

interface ModelPreviewProps {
  url: string;
  onClose: () => void;
  name: string;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

const ModelPreview: React.FC<ModelPreviewProps> = memo(({ url, onClose, name }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose}></div>
      <div className="bg-white w-full max-w-5xl h-full max-h-[85vh] rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-white/10">
        <div className="h-20 border-b border-gray-100 flex items-center justify-between px-10 shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shadow-lg">
              <div className="text-xs font-black">3D</div>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter">{name}</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">3D Model Preview</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="flex-1 bg-slate-50 relative">
          <model-viewer
            src={url}
            alt={name}
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style={{ width: '100%', height: '100%', backgroundColor: '#f8fafc' }}
          ></model-viewer>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
            <div className="px-6 py-2 bg-white/80 backdrop-blur shadow-xl rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100">
              Drag to Rotate • Scroll to Zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ModelPreview.displayName = 'ModelPreview';

export default ModelPreview;
