'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  icon: React.ElementType;
  openSection: string;
  setOpenSection: (v: string) => void;
}

export default function SectionHeader({ id, title, icon: Icon, openSection, setOpenSection }: Props) {
  return (
    <button
      onClick={() => setOpenSection(openSection === id ? '' : id)}
      className="w-full flex items-center justify-between p-5 hover:bg-[#fafbfc] transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-500" />
        <h2 className="text-[14px] font-bold text-[#1f2937]">{title}</h2>
      </div>
      {openSection === id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
  );
}
