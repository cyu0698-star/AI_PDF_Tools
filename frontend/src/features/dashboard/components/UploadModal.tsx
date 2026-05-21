"use client";

import { useCallback, useState } from "react";
import { UploadedFile, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE, formatFileSize, getFileTypeLabel, getFileTypeColor } from "@/features/documents/types";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesAdded: (files: UploadedFile[]) => void;
}

export default function UploadModal({ isOpen, onClose, onFilesAdded }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);

  const processFiles = useCallback((fileList: FileList) => {
    const file = fileList[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件 "${file.name}" 超过50MB限制`);
      return;
    }
    const uf: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    };
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        uf.preview = e.target?.result as string;
        setPendingFiles([uf]);
      };
      reader.readAsDataURL(file);
      return;
    }
    setPendingFiles([uf]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleConfirm = () => {
    if (pendingFiles.length > 0) {
      onFilesAdded(pendingFiles);
      setPendingFiles([]);
      onClose();
    }
  };

  const handleClose = () => {
    setPendingFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">上传文件</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              每次最多可上传一个文件，单个文件大小上限为50 MB。
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div className="px-6 pb-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all min-h-[200px] ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {pendingFiles.length > 0 ? (
              <div className="w-full space-y-2">
                {pendingFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-slate-100 shadow-sm">
                    <div className={`text-[10px] font-bold px-2 py-1 rounded ${getFileTypeColor(f.type)}`}>
                      {getFileTypeLabel(f.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-400">{formatFileSize(f.size)}</div>
                    </div>
                    <button
                      onClick={() => setPendingFiles((prev) => prev.filter((p) => p.id !== f.id))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm text-slate-500 mb-1">
                  <label className="text-blue-600 font-semibold cursor-pointer hover:underline">
                    点击上传
                    <input
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={(e) => {
                        if (e.target.files) processFiles(e.target.files);
                      }}
                      className="hidden"
                    />
                  </label>
                  {" "}或者拖拽到这里
                </p>
                <p className="text-xs text-slate-400">
                  支持 PDF/JPG/PNG/WEBP
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {pendingFiles.length > 0 && (
          <div className="px-6 pb-5 flex justify-end">
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
            >
              确认
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
