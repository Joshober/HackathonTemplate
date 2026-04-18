import { Luggage } from "lucide-react";

interface PageHeaderProps {
  subtitle?: string;
}

export function PageHeader({ subtitle }: PageHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 glass-panel-dark border-b border-white/10">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 glass-gradient-button rounded-lg flex items-center justify-center shine-overlay">
          <Luggage className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-white">Suitcase Squad</h1>
      </div>
      {subtitle && (
        <p className="text-sm text-gray-400 ml-11">{subtitle}</p>
      )}
    </div>
  );
}