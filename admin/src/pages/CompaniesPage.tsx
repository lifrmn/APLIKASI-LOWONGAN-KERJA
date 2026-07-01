import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle } from 'lucide-react';

import { api, PaginationMeta } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';

interface CompanyRow {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  verificationStatus: string;
  createdAt: string;
}

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const query = useQuery({
    queryKey: ['companies', page, status],
    queryFn: async () => {
      const res = await api.get('/companies', {
        params: { page, limit: 20, verificationStatus: status || undefined },
      });
      return {
        data: (res.data?.data ?? []) as CompanyRow[],
        meta: res.data?.meta as PaginationMeta | undefined,
      };
    },
    placeholderData: (prev) => prev,
  });

  const verify = useMutation({
    mutationFn: async (id: string) => api.patch(`/companies/${id}/verify`),
    onSuccess: () => {
      toast.success('Perusahaan diverifikasi');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Gagal verifikasi'),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/companies/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Perusahaan ditolak');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Gagal menolak'),
  });

  function doReject(id: string) {
    const reason = window.prompt('Alasan penolakan (min 5 karakter):');
    if (!reason || reason.length < 5) return;
    reject.mutate({ id, reason });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Perusahaan</h1>

      <div className="mb-3">
        <label className="text-sm mr-2">Filter status:</label>
        <select
          className="input inline-block w-auto"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Semua</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Telepon</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Dibuat</th>
              <th className="px-4 py-2 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.data?.data?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{c.companyName}</td>
                <td className="px-4 py-2">{c.email ?? '-'}</td>
                <td className="px-4 py-2">{c.phone ?? '-'}</td>
                <td className="px-4 py-2"><StatusBadge status={c.verificationStatus} /></td>
                <td className="px-4 py-2 text-slate-500">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  {c.verificationStatus === 'PENDING' ? (
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-primary !py-1 !px-2"
                        onClick={() => verify.mutate(c.id)}
                        disabled={verify.isPending}
                      >
                        <CheckCircle2 size={14} /> Verify
                      </button>
                      <button
                        className="btn-danger !py-1 !px-2"
                        onClick={() => doReject(c.id)}
                        disabled={reject.isPending}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {query.isFetching && !query.data && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-slate-500">Memuat...</td></tr>
            )}
            {!query.isFetching && !query.data?.data?.length && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-slate-500">Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={query.data?.meta} onChange={setPage} />
    </div>
  );
}
