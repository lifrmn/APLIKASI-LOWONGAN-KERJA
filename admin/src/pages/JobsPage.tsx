import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, PaginationMeta } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';

interface JobRow {
  id: string;
  title: string;
  status: string;
  employmentType: string;
  workType: string;
  publishedAt: string | null;
  deadline: string | null;
  company?: { companyName: string };
}

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['jobs', page, status],
    queryFn: async () => {
      const res = await api.get('/jobs', { params: { page, limit: 20, status: status || undefined } });
      return {
        data: (res.data?.data ?? []) as JobRow[],
        meta: res.data?.meta as PaginationMeta | undefined,
      };
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Lowongan</h1>

      <div className="mb-3">
        <label className="text-sm mr-2">Status:</label>
        <select
          className="input inline-block w-auto"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">Semua</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CLOSED">Closed</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Judul</th>
              <th className="px-4 py-2 font-medium">Perusahaan</th>
              <th className="px-4 py-2 font-medium">Tipe</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Deadline</th>
              <th className="px-4 py-2 font-medium">Publish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data?.map((j) => (
              <tr key={j.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{j.title}</td>
                <td className="px-4 py-2">{j.company?.companyName ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600">
                  {j.employmentType} · {j.workType}
                </td>
                <td className="px-4 py-2"><StatusBadge status={j.status} /></td>
                <td className="px-4 py-2 text-slate-500">{formatDate(j.deadline)}</td>
                <td className="px-4 py-2 text-slate-500">{formatDate(j.publishedAt)}</td>
              </tr>
            ))}
            {isFetching && !data && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-slate-500">Memuat...</td></tr>
            )}
            {!isFetching && !data?.data?.length && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-slate-500">Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} onChange={setPage} />
    </div>
  );
}
