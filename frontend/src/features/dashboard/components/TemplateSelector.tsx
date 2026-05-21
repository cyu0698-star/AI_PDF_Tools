"use client";

import { useState, useEffect } from "react";
import { TemplateType, CustomTemplate, TEMPLATES } from "@/features/documents/types";
import { getTemplatesByCategory, deleteTemplate } from "@/features/templates/storage/templateStorage";

interface TemplateSelectorProps {
  selectedType: TemplateType | null;
  selectedCustomTemplate: CustomTemplate | null;
  onSelectType: (type: TemplateType) => void;
  onSelectCustomTemplate: (template: CustomTemplate) => void;
  onCreateTemplate: (category: TemplateType, categoryName: string) => void;
  refreshKey?: number;
}

export default function TemplateSelector({
  selectedType: _selectedType,
  selectedCustomTemplate,
  onSelectType: _onSelectType,
  onSelectCustomTemplate,
  onCreateTemplate,
  refreshKey = 0,
}: TemplateSelectorProps) {
  void _selectedType;
  void _onSelectType;
  const [customTemplates, setCustomTemplates] = useState<Record<TemplateType, CustomTemplate[]>>({
    delivery_note: [],
    reconciliation: [],
    purchase_order: [],
    quotation: [],
    bank_statement: [],
    payment_list: [],
  });

  useEffect(() => {
    const loadTemplates = () => {
      const templates: Record<TemplateType, CustomTemplate[]> = {
        delivery_note: getTemplatesByCategory("delivery_note"),
        reconciliation: getTemplatesByCategory("reconciliation"),
        purchase_order: getTemplatesByCategory("purchase_order"),
        quotation: getTemplatesByCategory("quotation"),
        bank_statement: getTemplatesByCategory("bank_statement"),
        payment_list: getTemplatesByCategory("payment_list"),
      };
      setCustomTemplates(templates);
    };
    loadTemplates();
  }, [refreshKey]);

  const handleDeleteTemplate = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    if (confirm("确定要删除这个模板吗？")) {
      deleteTemplate(templateId);
      const templates: Record<TemplateType, CustomTemplate[]> = {
        delivery_note: getTemplatesByCategory("delivery_note"),
        reconciliation: getTemplatesByCategory("reconciliation"),
        purchase_order: getTemplatesByCategory("purchase_order"),
        quotation: getTemplatesByCategory("quotation"),
        bank_statement: getTemplatesByCategory("bank_statement"),
        payment_list: getTemplatesByCategory("payment_list"),
      };
      setCustomTemplates(templates);
    }
  };

  const handleTemplateCardKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    template: CustomTemplate
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectCustomTemplate(template);
    }
  };

  const salesTemplates = TEMPLATES.filter((t) => t.category === "sales");
  const financeTemplates = TEMPLATES.filter((t) => t.category === "finance");

  const renderCategorySection = (
    title: string,
    templates: typeof TEMPLATES,
    colSpanClass: string = ""
  ) => (
    <>
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      <div className="space-y-3 mb-5">
        {templates.map((t) => {
          const customs = customTemplates[t.id] || [];
          const hasCustoms = customs.length > 0;

          return (
            <div key={t.id} className="space-y-2">
              {/* Category header */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{t.name}</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>

              {/* Custom templates for this category */}
              {hasCustoms && (
                <div className="grid grid-cols-2 gap-2">
                  {customs.map((custom) => (
                    <div
                      key={custom.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectCustomTemplate(custom)}
                      onKeyDown={(e) => handleTemplateCardKeyDown(e, custom)}
                      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                        selectedCustomTemplate?.id === custom.id
                          ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm shadow-blue-100"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      } cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400`}
                    >
                      {custom.previewImage ? (
                        <img
                          src={custom.previewImage}
                          alt=""
                          className="w-5 h-5 rounded object-cover"
                        />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      <span className="truncate flex-1">{custom.name}</span>
                      <button
                        onClick={(e) => handleDeleteTemplate(e, custom.id)}
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new template button */}
              <button
                onClick={() => onCreateTemplate(t.id, t.name)}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-200 text-sm font-medium text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all ${colSpanClass}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                上传{t.name}模板
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="w-[300px] flex-shrink-0">
      <h3 className="text-base font-bold text-slate-800 mb-1">模版选择</h3>
      <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
        选择已有模板或上传新模板，然后上传原始单据进行数据提取。
      </p>

      {/* Sales templates */}
      {renderCategorySection("销售业务", salesTemplates)}

      {/* Finance templates */}
      {renderCategorySection("财务业务", financeTemplates)}

      {/* Tip */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-600 leading-relaxed">
          <strong>使用说明：</strong>
          <br />1. 点击&quot;上传XX模板&quot;创建新模板
          <br />2. 选择已有模板后，上传原始单据
          <br />3. AI 将自动提取数据并填充
        </p>
      </div>
    </div>
  );
}
