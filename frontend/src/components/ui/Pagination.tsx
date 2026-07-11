import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  dark?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  dark
}: PaginationProps) {
  const pageBtnCls = `h-7 w-7 flex items-center justify-center rounded-lg border border-color hover-bg disabled:opacity-40 transition-all`;

  return (
    <div className={`border-t border-color px-5 py-3 flex items-center justify-between text-xs ${dark ? "bg-slate-800/40" : "bg-gray-50"}`}>
      <span className="text-brand font-medium">
        Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems.toLocaleString()} entries
      </span>
      <div className="flex items-center gap-1">
        <button 
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))} 
          disabled={currentPage === 1} 
          className={pageBtnCls}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-muted-color" />
        </button>
        <span className="px-3 py-1 rounded-lg bg-brand text-white font-bold text-[11px]">{currentPage}</span>
        <button 
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))} 
          disabled={currentPage === totalPages || totalPages === 0} 
          className={pageBtnCls}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-color" />
        </button>
      </div>
    </div>
  );
}
