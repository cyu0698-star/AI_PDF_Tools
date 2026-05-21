"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    label: "Step 1",
    title: "上传文档",
    desc: "拖拽或选择财务文件",
  },
  {
    label: "Step 2",
    title: "AI 智能解析",
    desc: "深度理解文档结构与内容",
  },
  {
    label: "Step 3",
    title: "生成标准表单",
    desc: "自动匹配模版，填充结构化数据",
  },
  {
    label: "Complete",
    title: "转换完成",
    desc: "原始文件 → 标准化表单",
  },
];

export default function DemoAnimation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const durations = [3400, 4200, 3800, 3200];
    let timer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;

    function runStep(step: number) {
      setCurrentStep(step);
      setProgress(0);

      if (step === 1) {
        let p = 0;
        progressTimer = setInterval(() => {
          p += 2;
          setProgress(Math.min(p, 100));
          if (p >= 100) clearInterval(progressTimer);
        }, 65);
      }

      timer = setTimeout(() => {
        if (step < 3) {
          runStep(step + 1);
        } else {
          setTimeout(() => runStep(0), 2800);
        }
      }, durations[step]);
    }

    const init = setTimeout(() => runStep(0), 500);
    return () => {
      clearTimeout(init);
      clearTimeout(timer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-10 py-12">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(37,99,235,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 90%, rgba(52,199,89,0.04) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, #94a3b8 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 text-center w-full max-w-[520px]">
        {/* Brand */}
        <div className="inline-flex items-center gap-2 mb-5 text-sm font-semibold text-slate-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
              fill="#ef4444"
            />
          </svg>
          <span>I Love 财务表单</span>
        </div>

        {/* Tagline */}
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-800">
          <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 bg-clip-text text-transparent animate-gradient">
            AI 驱动
          </span>
          ，一键转换财务文件。
        </h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          上传任意格式的财务文档，AI 自动识别、提取、标准化，秒级生成规范表单。
        </p>

        {/* Demo Box */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-400">
          {/* Toolbar */}
          <div className="px-4 py-3 flex items-center gap-[7px] border-b border-black/5 bg-gradient-to-b from-white to-slate-50">
            <span className="w-[11px] h-[11px] rounded-full bg-[#ff5f57]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#febc2e]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#28c840]" />
            <span className="flex-1 text-center text-xs font-medium text-slate-400 mr-[50px]">
              智能转换工作流
            </span>
          </div>

          {/* Body */}
          <div className="p-6 min-h-[300px] relative">
            {/* Step pips */}
            <div className="flex items-center justify-center gap-1 mb-6">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-[6px] rounded-full transition-all duration-500 ${
                    i === currentStep
                      ? "w-7 bg-blue-600"
                      : "w-[6px] bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Step label */}
            <div className="text-center mb-6">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-2 ${
                  currentStep === 3
                    ? "bg-green-50 text-green-500"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                {STEPS[currentStep].label}
              </span>
              <div className="text-[17px] font-bold text-slate-800 tracking-tight">
                {STEPS[currentStep].title}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {STEPS[currentStep].desc}
              </div>
            </div>

            {/* Scene content */}
            <div className="min-h-[160px] flex items-center justify-center">
              {currentStep === 0 && <UploadScene />}
              {currentStep === 1 && <AIScene progress={progress} />}
              {currentStep === 2 && <TableScene />}
              {currentStep === 3 && <CompareScene />}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-black/5 flex items-center justify-between bg-white">
            <span className="text-[11px] text-slate-400">
              {currentStep + 1} / 4 — {STEPS[currentStep].title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadScene() {
  return (
    <div className="w-full space-y-2 animate-fade-in">
      <div className="border border-dashed border-blue-300 bg-blue-50/50 rounded-xl p-4 space-y-2">
        {[
          { name: "2024_Q3_采购订单.pdf", size: "2.4 MB", color: "bg-red-50 text-red-500" },
          { name: "供应商送货单_0915.jpg", size: "1.1 MB", color: "bg-orange-50 text-orange-500" },
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-black/5 shadow-sm animate-fade-in-up"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className={`w-8 h-8 rounded-lg ${f.color} flex items-center justify-center text-xs font-bold`}>
              {f.name.endsWith(".pdf") ? "PDF" : "IMG"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-700 truncate">{f.name}</div>
              <div className="text-[10px] text-slate-400">{f.size}</div>
            </div>
            <div className="w-[18px] h-[18px] rounded-full bg-green-500 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIScene({ progress }: { progress: number }) {
  const chips = ["表头识别", "金额提取", "日期解析", "供应商匹配", "格式标准化"];
  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative w-[72px] h-[72px]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-purple-500 flex items-center justify-center animate-pulse-ring">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" />
            <path d="M8.25 9.93A4 4 0 0 1 12 2" />
            <path d="M12 22a4 4 0 0 1-4-4c0-1.95 1.4-3.58 3.25-3.93" />
            <path d="M15.75 14.07A4 4 0 0 1 12 22" />
          </svg>
        </div>
        <div className="absolute -inset-3 rounded-full border border-blue-200 animate-spin-slow" />
        <div className="absolute -inset-7 rounded-full border border-dashed border-blue-100" style={{ animation: "spin-slow 10s linear infinite reverse" }} />
      </div>
      <div className="text-[13px] font-semibold text-slate-700">
        {progress >= 100 ? "解析完成" : "正在识别..."}
      </div>
      <div className="w-[200px]">
        <div className="w-full h-[3px] bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {chips.map((c, i) => (
          <span
            key={i}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all duration-300 ${
              progress > i * 20
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function TableScene() {
  const data = [
    { date: "09/15", supplier: "华鑫科技", item: "芯片模组 A", qty: "500", amount: "¥75,000" },
    { date: "09/15", supplier: "华鑫科技", item: "连接器 B", qty: "1,200", amount: "¥18,600" },
    { date: "09/16", supplier: "鼎盛材料", item: "PCB 板材", qty: "300", amount: "¥42,300" },
  ];
  return (
    <div className="w-full animate-fade-in-up">
      <div className="border border-black/5 rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50">
              {["日期", "供应商", "品名", "数量", "金额"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t border-black/5 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <td className="px-3 py-2 text-slate-500">{r.date}</td>
                <td className="px-3 py-2 text-slate-500">{r.supplier}</td>
                <td className="px-3 py-2 text-slate-500">{r.item}</td>
                <td className="px-3 py-2 text-slate-500">{r.qty}</td>
                <td className="px-3 py-2 font-semibold text-slate-800 text-right">{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareScene() {
  return (
    <div className="w-full flex gap-3 items-stretch animate-fade-in">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="text-[10px] font-semibold text-center py-1 rounded-md bg-red-50 text-red-500">
          原始文件
        </div>
        <div className="flex-1 bg-slate-50 border border-black/5 rounded-xl p-3 space-y-1.5">
          {[65, 88, 40, 75, 55, 82].map((w, i) => (
            <div key={i} className="h-[5px] rounded bg-slate-200" style={{ width: `${w}%`, opacity: 0.6 }} />
          ))}
        </div>
      </div>
      <div className="flex items-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="text-[10px] font-semibold text-center py-1 rounded-md bg-green-50 text-green-500">
          标准表单
        </div>
        <div className="flex-1 bg-white border-[1.5px] border-green-400 rounded-xl p-3 space-y-1.5 relative shadow-sm shadow-green-100">
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="h-[7px] rounded bg-blue-600 w-full opacity-20" />
          {[100, 100, 100, 100, 78].map((w, i) => (
            <div key={i} className="h-[5px] rounded bg-blue-200" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
