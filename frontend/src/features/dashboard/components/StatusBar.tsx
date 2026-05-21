"use client";

import { AppStep } from "@/features/documents/types";

interface StatusBarProps {
  fileCount: number;
  step: AppStep;
  templateSelected: boolean;
  onGenerate: () => void;
  onDownload: () => void;
  isProcessing: boolean;
}

export default function StatusBar({
  fileCount,
  step,
  templateSelected,
  onGenerate,
  onDownload,
  isProcessing,
}: StatusBarProps) {
  const getStatusText = () => {
    if (step === "result") return "当前状态：已生成文稿";
    if (step === "editForm") return "当前状态：编辑表单中";
    if (step === "processing" || step === "extractingData") return "当前状态：AI 正在处理中...";
    return `当前状态：已上传${fileCount}个文档`;
  };

  const getNextStepText = () => {
    if (step === "result") return "下一步：点击下载";
    if (step === "editForm") return "编辑完成后可导出";
    if (step === "processing" || step === "extractingData") return "请等待处理完成";
    if (fileCount === 0) return "下一步：上传原始单据";
    if (!templateSelected) return "下一步：选择或创建模板";
    return "下一步：点击开始提取数据";
  };

  const canGenerate = fileCount > 0 && templateSelected && step === "upload";

  return (
    <div className="h-14 border-t border-slate-100 bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            step === "result" || step === "editForm"
              ? "bg-green-500"
              : step === "processing" || step === "extractingData"
              ? "bg-yellow-500 animate-pulse"
              : fileCount > 0
              ? "bg-blue-500"
              : "bg-slate-300"
          }`}
        />
        <span className="text-sm text-slate-500">{getStatusText()}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-400">{getNextStepText()}</span>
        {step === "result" ? (
          <button
            onClick={onDownload}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            开始下载
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={!canGenerate || isProcessing}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isProcessing && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            )}
            开始生成
          </button>
        )}
      </div>
    </div>
  );
}
