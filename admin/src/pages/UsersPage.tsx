import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, PaginationMeta } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import { Search } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  role?: { name: string };
  createdAt: string;
}

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['users', page, q],
    queryFn: async () => {
      const res = await api.get('/users', { params: { page, limit: 20, search: q || undefined } });
      // Response bentuk paginated: { success, message, data: [...], meta: {...} }
      const body = res.data;
      return {
        data: (body?.data ?? []) as UserRow[],
        meta: body?.meta as PaginationMeta | undefined,
      };
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Users</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
        className="flex gap-2 mb-4"
      >
        <div className="relative flex-1 max-w-sm">
          <input
            className="input pl-9"
            placeholder="Cari nama / email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        </div>
        <button className="btn-primary">Cari</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isFetching && !data && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-500">Memuat...</td></tr>
            )}
            {data?.data?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{u.fullName}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.role?.name ?? '-'}</td>
                <td className="px-4 py-2"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-2 text-slate-500">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
            {!isFetching && !data?.data?.length && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-500">Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} onChange={setPage} />
    </div>
  );
}
