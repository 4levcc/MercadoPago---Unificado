import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Clock, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle
} from 'lucide-react';
import type { Extrato } from '../db/database';

// ─────────────────────────────────────────────────────────────────────────────
// Status badge component
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'Conciliado') return (
    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
      <CheckCircle2 className="w-3 h-3 mr-1" />Conciliado
    </span>
  );
  if (status === 'Conciliado Divergente') return (
    <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
      <AlertTriangle className="w-3 h-3 mr-1" />Conciliado Divergente
    </span>
  );
  if (status === 'Não Conciliado') return (
    <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
      <XCircle className="w-3 h-3 mr-1" />Não Conciliado
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-medium">
      <Clock className="w-3 h-3 mr-1" />Pendente
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'geral' | 'divergentes' | 'nao_conciliados';

const TABS: { key: Tab; label: string }[] = [
  { key: 'geral', label: 'Conciliação Geral' },
  { key: 'divergentes', label: 'Divergentes' },
  { key: 'nao_conciliados', label: 'Não Conciliadas' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Inner table for a given list of extratos
// ─────────────────────────────────────────────────────────────────────────────
const ExtratoTable: React.FC<{ rows: Extrato[] }> = ({ rows }) => {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [sortConfig, setSortConfig] = useState<{ key: keyof Extrato; direction: 'asc' | 'desc' }>({
    key: 'release_date', direction: 'asc'
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  const handleSort = (key: keyof Extrato) => {
    setSortConfig(cur => ({
      key,
      direction: cur.key === key && cur.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(0);
  };

  const SortIcon = ({ col }: { col: keyof Extrato }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary-600" />;
  };

  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500 text-sm">
        Nenhum registro nesta categoria.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('release_date')}>
                <div className="flex items-center">Data <SortIcon col="release_date" /></div>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('reference_id')}>
                <div className="flex items-center">Reference ID <SortIcon col="reference_id" /></div>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('transaction_type')}>
                <div className="flex items-center">Tipo (Extrato) <SortIcon col="transaction_type" /></div>
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('transaction_net_amount')}>
                <div className="flex items-center justify-end">Valor Líquido <SortIcon col="transaction_net_amount" /></div>
              </th>
              <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status_conciliacao')}>
                <div className="flex items-center justify-center">Status <SortIcon col="status_conciliacao" /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map(ext => (
              <tr key={ext.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{ext.release_date}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ext.reference_id}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={ext.transaction_type}>
                  {ext.transaction_type}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  ext.transaction_net_amount < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  R$ {ext.transaction_net_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={ext.status_conciliacao} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-gray-100 bg-gray-50">
          <span className="text-sm text-gray-500">
            Página {page + 1} de {totalPages} · {rows.length.toLocaleString('pt-BR')} registros
          </span>
          <div className="flex space-x-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              aria-label="Página anterior"
              className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              aria-label="Próxima página"
              className="p-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component with 3 tabs
// ─────────────────────────────────────────────────────────────────────────────
export const TransactionsTable: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('geral');

  const allExtratos = useLiveQuery(() => db.extratos.toArray(), []);

  const { geral, divergentes, naoConciliados } = useMemo(() => {
    if (!allExtratos) return { geral: [], divergentes: [], naoConciliados: [] };
    return {
      geral: allExtratos,
      divergentes: allExtratos.filter(e => e.status_conciliacao === 'Conciliado Divergente'),
      naoConciliados: allExtratos.filter(e => e.status_conciliacao === 'Não Conciliado'),
    };
  }, [allExtratos]);

  if (!allExtratos) {
    return <div className="p-4 text-center text-gray-500">Carregando...</div>;
  }

  const tabRows: Record<Tab, Extrato[]> = {
    geral,
    divergentes,
    nao_conciliados: naoConciliados,
  };

  const tabCounts: Record<Tab, number> = {
    geral: geral.length,
    divergentes: divergentes.length,
    nao_conciliados: naoConciliados.length,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Prévia do Extrato</h3>
        <span className="text-sm text-gray-500">{geral.length.toLocaleString('pt-BR')} registros importados</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {TABS.map(tab => {
          const count = tabCounts[tab.key];
          const isActive = activeTab === tab.key;
          const badgeColor =
            tab.key === 'divergentes' ? 'bg-orange-100 text-orange-700' :
            tab.key === 'nao_conciliados' ? 'bg-red-100 text-red-700' :
            'bg-primary-100 text-primary-700';

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? 'border-primary-500 text-primary-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${badgeColor}`}>
                  {count.toLocaleString('pt-BR')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table content */}
      <ExtratoTable rows={tabRows[activeTab]} />
    </div>
  );
};
