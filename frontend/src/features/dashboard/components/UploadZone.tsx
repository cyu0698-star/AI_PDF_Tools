"use client";

import { useCallback, useState } from "react";
import { UploadedFile, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE, formatFileSize, getFileTypeLabel, getFileTypeColor } from "@/features/documents/types";

interface UploadZoneProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileRemove: (id: string) => void;
  onUploadClick: () => void;
}

export default function UploadZone({ files, onFilesAdded, onFileRemove, onUploadClick }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (fileList: FileList) => {
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
          onFilesAdded([uf]);
        };
        reader.readAsDataURL(file);
        return;
      }

      onFilesAdded([uf]);
    },
    [onFilesAdded]
  );

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

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const hasFiles = files.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Main upload area */}
      <div
        className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all relative ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : hasFiles
            ? "border-slate-200 bg-white"
            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {hasFiles ? (
          /* File preview area */
          <div className="w-full h-full p-6 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              {/* Large preview of first file */}
              <div className="w-full max-w-md">
                {files[0]?.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={files[0].preview}
                    alt={files[0].name}
                    className="max-h-[280px] mx-auto rounded-lg shadow-md border border-slate-100 object-contain"
                  />
                ) : (
                  <div className="h-[280px] bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center">
                    <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${getFileTypeColor(files[0]?.type || "")}`}>
                      {getFileTypeLabel(files[0]?.type || "")}
                    </div>
                    <div className="text-sm text-slate-500 mt-3 max-w-[240px] truncate">{files[0]?.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatFileSize(files[0]?.size || 0)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="relative group w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden"
                >
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getFileTypeColor(f.type)}`}>
                      {getFileTypeLabel(f.type)}
                    </span>
                  )}
                  <button
                    onClick={() => onFileRemove(f.id)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
              {/* Add more button */}
              <button
                onClick={onUploadClick}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Tip */}
            <p className="text-[11px] text-slate-400 mt-3">
              当前流程每次仅处理 1 个文件（PDF/图片）。
            </p>
          </div>
        ) : (
          /* Empty upload state */
          <div className="text-center">
            {/* File type icons */}
            <div className="flex items-center justify-center gap-2 mb-4">
                {[
                  { label: "PDF", color: "bg-red-100 text-red-500" },
                  { label: "JPG", color: "bg-orange-100 text-orange-500" },
                  { label: "PNG", color: "bg-green-100 text-green-500" },
                  { label: "WEBP", color: "bg-emerald-100 text-emerald-600" },
                ].map((t) => (
                  <span key={t.label} className={`text-[10px] font-bold px-2 py-1 rounded ${t.color}`}>
                    {t.label}
                  </span>
                ))}
              </div>
              
              <p className="text-xs text-slate-400 mb-5">文件大小限制 50MB</p>

            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                在你的电脑中选择文件
              </span>
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
