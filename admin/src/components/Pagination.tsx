import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '../lib/api';

interface Props {
  meta?: PaginationMeta;
  onChange: (page: number) => void;
}

export function Pagination({ meta, onChange }: Props) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total } = meta;
  return (
    <div className="flex items-center justify-between text-sm text-slate-600 mt-3">
      <div>
        Halaman <b>{page}</b> dari <b>{totalPages}</b> · Total <b>{total}</b>
      </div>
      <div className="flex gap-1">
        <button
          className="btn-outline !py-1 !px-2"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-outline !py-1 !px-2"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
