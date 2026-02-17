'use client';

import React, { useState, useEffect } from 'react';
import { Objective } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { api } from '@/lib/api';
import { Upload, File, X } from 'lucide-react';

interface OKRModalFilesProps {
  objectiveId: string;
  objective: Objective;
  permissions: OKRPermissions;
  onUpdate: (objective: Objective) => void;
}

export function OKRModalFiles({ objectiveId, objective, permissions, onUpdate }: OKRModalFilesProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const fileList = await api.listFiles(objectiveId);
        setFiles(fileList);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [objectiveId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadFile(objectiveId, file, { associatedWith: 'objective' });
      // Reload files
      const fileList = await api.listFiles(objectiveId);
      setFiles(fileList);
      // Reload objective
      const updated = await api.getObjective(objectiveId);
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await api.deleteFile(fileId);
      setFiles(prev => prev.filter(f => f._id !== fileId));
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissions.canEditObjective && (
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Upload File</span>
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
            </label>
          </div>
        )}

        {loading ? (
          <div>Loading files...</div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div key={file._id} className="border rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4" />
                      <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {permissions.canEditObjective && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(file._id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {file.thumbnailUrl && (
                  <img src={file.thumbnailUrl} alt={file.name} className="mt-2 w-full h-24 object-cover rounded" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No files uploaded</div>
        )}
      </CardContent>
    </Card>
  );
}
