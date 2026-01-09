import React, { useState } from 'react';
import { FilesManager } from './FilesManager';
import { FileDetails } from './FileDetails';
import { FileMetadata } from '@qemuweb/storage';

interface AtlasDashboardProps {
  onError?: (error: Error) => void;
}

export const AtlasDashboard: React.FC<AtlasDashboardProps> = ({ onError }) => {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

  const handleFileSelect = (file: FileMetadata) => {
    setSelectedFile(file);
  };

  const handleFileUpdate = (updated: FileMetadata) => {
    setSelectedFile(updated);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Atlas Store</h1>
        <p className="text-gray-600">
          Content-addressed file storage with provenance tracking
        </p>
      </div>

      <FilesManager
        onFileSelect={handleFileSelect}
        onError={onError}
      />

      {selectedFile && (
        <FileDetails
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onUpdate={handleFileUpdate}
          onError={onError}
        />
      )}
    </div>
  );
};
