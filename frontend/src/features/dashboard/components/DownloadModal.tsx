"use client";

import { ProcessResult } from "@/features/documents/types";
import { exportProcessResultToExcel, exportToCSV, exportToJSON } from "@/shared/utils/exportUtils";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProcessResult | null;
  templateName?: string;
}

export default function DownloadModal({ isOpen, onClose, result, templateName }: DownloadModalProps) {
  if (!isOpen || !result) return null;

  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = templateName || '财务表单';

  const downloadExcel = () => {
    if (!result) return;
    exportProcessResultToExcel(result, baseName);
    onClose();
  };

  const downloadCSV = () => {
    if (!result) return;
    exportToCSV(result.headers, result.rows, `${baseName}_${dateStr}.csv`);
  };

  const downloadJSON = () => {
    if (!result) return;
    exportToJSON(
      { summary: result.summary, headers: result.headers, data: result.rows },
      `${baseName}_${dateStr}.json`
    );
  };

  const hasTableData = result.headers.length > 0 && result.rows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold text-slate-800">下载文件</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* File list */}
        <div className="px-6 pb-4 space-y-2">
          {/* Excel - Recommended for table data */}
          {hasTableData && (
            <button
              onClick={downloadExcel}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-green-200 bg-green-50/50 hover:border-green-400 hover:bg-green-50 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                XLS
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-slate-700 group-hover:text-green-700 flex items-center gap-2">
                  {baseName}_{dateStr}.xlsx
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded">推荐</span>
                </div>
                <div className="text-[11px] text-slate-400">Excel 格式，支持多工作表</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 group-hover:text-green-600">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}

          {/* CSV */}
          <button
            onClick={downloadCSV}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
              CSV
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                {baseName}_{dateStr}.csv
              </div>
              <div className="text-[11px] text-slate-400">通用表格格式</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-blue-600">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* JSON */}
          <button
            onClick={downloadJSON}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs font-bold">
              JSON
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                {baseName}_{dateStr}.json
              </div>
              <div className="text-[11px] text-slate-400">结构化数据，便于程序处理</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-blue-600">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>

        {/* Quick download button */}
        <div className="px-6 pb-5">
          <button
            onClick={hasTableData ? downloadExcel : downloadJSON}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {hasTableData ? '下载 Excel 文件' : '下载 JSON 文件'}
          </button>
        </div>
      </div>
    </div>
  );
}
