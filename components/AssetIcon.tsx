import React from 'react';
import { 
  FileText, Box, FileBox, Image as ImageIcon, Video, 
  ShieldCheck, Link as LinkIcon, QrCode, FileArchive 
} from 'lucide-react';

export const getAssetIcon = (type: string) => {
  switch (type) {
    case 'pdf': return <FileText className="text-red-500" />;
    case 'rvt': return <Box className="text-blue-500" />;
    case 'model': return <FileBox className="text-indigo-500" />;
    case 'image': return <ImageIcon className="text-green-500" />;
    case 'video': return <Video className="text-purple-500" />;
    case 'contract': return <ShieldCheck className="text-orange-500" />;
    case 'link': return <LinkIcon className="text-blue-400" />;
    case 'qr': return <QrCode className="text-gray-800" />;
    default: return <FileArchive className="text-gray-400" />;
  }
};
