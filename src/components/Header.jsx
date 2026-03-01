import { Truck } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-100">
      <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-800 text-white">
            <Truck className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-stone-900">
            MonBelier<span className="text-brand-600">.fr</span>
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-800">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          {"Livraison A\u00efd 2025"}
        </span>
      </div>
    </header>
  );
}
