import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, PaginationMeta } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { formatDate } from '../lib/format';

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  module: string | null;
  description: string | null;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['audit', page, module, action],
    queryFn: async () => {
      const res = await api.get('/audit-logs', {
        params: { page, limit: 30, module: module || undefined, action: action || undefined },
      });
      return {
        data: (res.data?.data ?? []) as AuditRow[],
        meta: res.data?.meta as PaginationMeta | undefined,
      };
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Audit Log</h1>

      <div className="flex gap-2 mb-3">
        <input
          className="input max-w-[10rem]"
          placeholder="Module (mis. AUTH)"
          value={module}
          onChange={(e) => setModule(e.target.value.toUpperCase())}
        />
        <input
          className="input max-w-[16rem]"
          placeholder="Action (mis. USER_LOGIN)"
          value={action}
          onChange={(e) => setAction(e.target.value.toUpperCase())}
        />
        <button className="btn-outline" onClick={() => setPage(1)}>Filter</button>
        <button
          className="btn-outline"
          onClick={() => {
            setModule('');
            setAction('');
            setPage(1);
          }}
        >Reset</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Waktu</th>
              <th className="px-4 py-2 font-medium">Module</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Deskripsi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {data?.data?.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-2">{a.module ?? '-'}</td>
                <td className="px-4 py-2">{a.action}</td>
                <td className="px-4 py-2">{a.entity ? `${a.entity}${a.entityId ? `#${a.entityId.slice(0, 8)}` : ''}` : '-'}</td>
                <td className="px-4 py-2">{a.userId ? a.userId.slice(0, 8) : '-'}</td>
                <td className="px-4 py-2">{a.ipAddress ?? '-'}</td>
                <td className="px-4 py-2 whitespace-pre-wrap font-sans">{a.description ?? '-'}</td>
              </tr>
            ))}
            {isFetching && !data && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">Memuat...</td></tr>
            )}
            {!isFetching && !data?.data?.length && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} onChange={setPage} />
    </div>
  );
}
