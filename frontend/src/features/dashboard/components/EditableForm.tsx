"use client";

import { useState, useCallback } from "react";
import { CustomTemplate, FilledFormData } from "@/features/documents/types";
import { exportFilledFormToExcel, exportToCSV, exportToJSON } from "@/shared/utils/exportUtils";

interface EditableFormProps {
  template: CustomTemplate;
  initialData: FilledFormData;
  onDataChange: (data: FilledFormData) => void;
  onBack: () => void;
}

export default function EditableForm({
  template,
  initialData,
  onDataChange,
  onBack,
}: EditableFormProps) {
  const [formData, setFormData] = useState<FilledFormData>(initialData);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportExcel = useCallback(() => {
    exportFilledFormToExcel(template, formData);
    setShowExportMenu(false);
  }, [template, formData]);

  const handleExportCSV = useCallback(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(
      template.structure.tableHeaders,
      formData.tableRows,
      `${template.name}_${dateStr}.csv`
    );
    setShowExportMenu(false);
  }, [template, formData]);

  const handleExportJSON = useCallback(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToJSON(
      {
        exportVersion: 2,
        templateName: template.name,
        templateId: template.id,
        templateCreatedAt: template.createdAt,
        templateCategory: template.category,
        templateStructure: template.structure,
        templateLayout: template.templateLayout || null,
        templateModel: template.templateModel || null,
        companyInfo: formData.companyInfo,
        tableHeaders: template.structure.tableHeaders,
        tableRows: formData.tableRows,
        summary: formData.summary,
      },
      `${template.name}_${dateStr}.json`
    );
    setShowExportMenu(false);
  }, [template, formData]);

  const handleCompanyInfoChange = useCallback((key: string, value: string) => {
    const newData = {
      ...formData,
      companyInfo: { ...formData.companyInfo, [key]: value },
    };
    setFormData(newData);
    onDataChange(newData);
  }, [formData, onDataChange]);

  const handleTableCellChange = useCallback((rowIndex: number, header: string, value: string) => {
    const newRows = [...formData.tableRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
    const newData = { ...formData, tableRows: newRows };
    setFormData(newData);
    onDataChange(newData);
  }, [formData, onDataChange]);

  const handleSummaryChange = useCallback((key: string, value: string) => {
    const newData = {
      ...formData,
      summary: { ...formData.summary, [key]: value },
    };
    setFormData(newData);
    onDataChange(newData);
  }, [formData, onDataChange]);

  const addTableRow = useCallback(() => {
    const emptyRow: Record<string, string> = {};
    template.structure.tableHeaders.forEach((header) => {
      emptyRow[header] = "";
    });
    const newData = {
      ...formData,
      tableRows: [...formData.tableRows, emptyRow],
    };
    setFormData(newData);
    onDataChange(newData);
  }, [formData, template.structure.tableHeaders, onDataChange]);

  const removeTableRow = useCallback((index: number) => {
    const newRows = formData.tableRows.filter((_, i) => i !== index);
    const newData = { ...formData, tableRows: newRows };
    setFormData(newData);
    onDataChange(newData);
  }, [formData, onDataChange]);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{template.name}</h2>
            <p className="text-sm text-slate-400">编辑表单数据，完成后可导出下载</p>
          </div>
        </div>
        
        {/* Export buttons */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">XLS</span>
                  <div>
                    <div className="text-sm font-medium text-slate-700">Excel 文件</div>
                    <div className="text-[10px] text-slate-400">推荐，多工作表</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">CSV</span>
                  <div>
                    <div className="text-sm font-medium text-slate-700">CSV 文件</div>
                    <div className="text-[10px] text-slate-400">通用表格格式</div>
                  </div>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="w-8 h-8 rounded bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs font-bold">JSON</span>
                  <div>
                    <div className="text-sm font-medium text-slate-700">JSON 文件</div>
                    <div className="text-[10px] text-slate-400">结构化数据</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Company Info Section */}
        {template.structure.companyInfo.fields.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M9 8h1" />
                <path d="M9 12h1" />
                <path d="M9 16h1" />
                <path d="M14 8h1" />
                <path d="M14 12h1" />
                <path d="M14 16h1" />
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              </svg>
              公司信息
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {template.structure.companyInfo.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={formData.companyInfo[field.key] || ""}
                    onChange={(e) => handleCompanyInfoChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder={`输入${field.label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table Section */}
        {template.structure.tableHeaders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <line x1="3" x2="21" y1="9" y2="9" />
                  <line x1="3" x2="21" y1="15" y2="15" />
                  <line x1="9" x2="9" y1="3" y2="21" />
                  <line x1="15" x2="15" y1="3" y2="21" />
                </svg>
                明细数据
              </h3>
              <button
                onClick={addTableRow}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                添加行
              </button>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-slate-500">#</th>
                      {template.structure.tableHeaders.map((header, i) => (
                        <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">
                          {header}
                        </th>
                      ))}
                      <th className="w-16 px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={template.structure.tableHeaders.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">
                          暂无数据，点击&quot;添加行&quot;开始录入
                        </td>
                      </tr>
                    ) : (
                      formData.tableRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-center text-sm text-slate-400">{rowIndex + 1}</td>
                          {template.structure.tableHeaders.map((header, colIndex) => (
                            <td key={colIndex} className="px-2 py-1.5">
                              <input
                                type={template.structure.tableFieldTypes[colIndex] === "number" ? "number" : "text"}
                                value={row[header] || ""}
                                onChange={(e) => handleTableCellChange(rowIndex, header, e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-slate-200 focus:border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                                placeholder="-"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => removeTableRow(rowIndex)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {template.structure.summaryFields.length > 0 && (
          <div className="bg-blue-50/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" />
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
              </svg>
              汇总信息
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {template.structure.summaryFields.map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{field}</label>
                  <input
                    type="text"
                    value={formData.summary[field] || ""}
                    onChange={(e) => handleSummaryChange(field, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder={`输入${field}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
