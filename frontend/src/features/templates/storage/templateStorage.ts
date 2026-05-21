import { CustomTemplate, TemplateType } from "@/features/documents/types";

const STORAGE_KEY = 'custom_templates';

export function getTemplates(): CustomTemplate[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CustomTemplate[];
  } catch {
    console.error('Failed to parse templates from localStorage');
    return [];
  }
}

export function getTemplatesByCategory(category: TemplateType): CustomTemplate[] {
  const templates = getTemplates();
  return templates.filter(t => t.category === category);
}

export function getTemplateById(id: string): CustomTemplate | null {
  const templates = getTemplates();
  return templates.find(t => t.id === id) || null;
}

export function saveTemplate(template: CustomTemplate): void {
  if (typeof window === 'undefined') return;
  
  const templates = getTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  if (typeof window === 'undefined') return;
  
  const templates = getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyTemplate(
  name: string,
  category: TemplateType,
  previewImage?: string
): CustomTemplate {
  return {
    id: generateTemplateId(),
    name,
    category,
    createdAt: new Date().toISOString(),
    previewImage,
    structure: {
      companyInfo: {
        fields: []
      },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: []
    }
  };
}
