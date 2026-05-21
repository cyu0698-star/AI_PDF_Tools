"use client";

import { useState } from "react";
import { ProcessResult, UploadedFile, getFileTypeLabel, getFileTypeColor } from "@/features/documents/types";

interface ResultViewProps {
  result: ProcessResult;
  files: UploadedFile[];
  onBack: () => void;
}

export default function ResultView({ result, files, onBack }: ResultViewProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [rows, setRows] = useState(result.rows);

  const handleCellEdit = (rowIdx: number, key: string, value: string) => {
    const newRows = [...rows];
    newRows[rowIdx] = { ...newRows[rowIdx], [key]: value };
    setRows(newRows);
  };

  return (
    <div className="flex-1 flex gap-6 overflow-hidden">
      {/* Left - Original file preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-auto">
            {files[0]?.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={files[0].preview}
                alt={files[0].name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            ) : (
              <div className="text-center">
                <div className={`inline-block text-3xl font-bold px-6 py-3 rounded-xl ${getFileTypeColor(files[0]?.type || "")}`}>
                  {getFileTypeLabel(files[0]?.type || "")}
                </div>
                <p className="text-sm text-slate-500 mt-4">{files[0]?.name}</p>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-white">
            {files.map((f, i) => (
              <div
                key={f.id}
                className={`w-12 h-12 rounded-lg border flex items-center justify-center overflow-hidden ${
                  i === 0 ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
                }`}
              >
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${getFileTypeColor(f.type)}`}>
                    {getFileTypeLabel(f.type)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Generated result */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                核对有误！修改表单信息并核对
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              点击表格单元格即可编辑，确认无误后请下载文件。
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回重新上传
          </button>
        </div>

        {/* Summary card */}
        {result.summary && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 grid grid-cols-2 gap-3">
            {result.summary.documentType && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">单据类型</div>
                <div className="text-sm font-semibold text-slate-700">{result.summary.documentType}</div>
              </div>
            )}
            {result.summary.documentDate && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">日期</div>
                <div className="text-sm font-semibold text-slate-700">{result.summary.documentDate}</div>
              </div>
            )}
            {result.summary.supplier && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">供应商/客户</div>
                <div className="text-sm font-semibold text-slate-700">{result.summary.supplier}</div>
              </div>
            )}
            {result.summary.totalAmount && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">总金额</div>
                <div className="text-sm font-bold text-blue-600">{result.summary.totalAmount}</div>
              </div>
            )}
          </div>
        )}

        {/* Data table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {result.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                  {result.headers.map((h, ci) => {
                    const isEditing = editingCell?.row === ri && editingCell?.key === h;
                    return (
                      <td
                        key={ci}
                        className="px-3 py-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap"
                        onClick={() => setEditingCell({ row: ri, key: h })}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={row[h] || ""}
                            onChange={(e) => handleCellEdit(ri, h, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                            }}
                            className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                            autoFocus
                          />
                        ) : (
                          <span className="hover:text-blue-600 transition-colors">
                            {row[h] || "-"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
