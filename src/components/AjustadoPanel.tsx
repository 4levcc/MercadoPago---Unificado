import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  Filter, X, ArrowUp, ArrowDown
} from 'lucide-react';
import { isDateInRange } from '../utils/date';

const ITEMS_PER_PAGE = 20;

interface AjustadoPanelProps {
  startDate: string;
  endDate: string;
  statusFilter: 'all' | 'analitico' | 'pendente';
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStatusFilterChange: (status: 'all' | 'analitico' | 'pendente') => void;
}

// Linha pivotada: 1 linha por REFERENCE_ID
interface LinhaAjustada {
  id: string;
  dataLancamento: string;
  tipoExtrato: string;
  referenceId: string;
  valorLiquidoExtrato: number;
  saldoParcial: number;
  statusConciliacao: 'Conciliado' | 'Sem correspondência no Movimento';
  totalMovimento: number | null;
  isConciliado: boolean;
}

type SortKey = keyof Pick<
  LinhaAjustada,
  'dataLancamento' | 'tipoExtrato' | 'referenceId' | 'valorLiquidoExtrato' | 'totalMovimento' | 'statusConciliacao'
>;

export function AjustadoPanel({
  startDate, endDate, statusFilter,
  onStartDateChange, onEndDateChange, onStatusFilterChange
}: AjustadoPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'dataLancamento',
    direction: 'desc',
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, statusFilter, sortConfig]);

  // Pré-carrega IDs com correspondência para filtro eficiente
  const conciliadosSet = useLiveQuery(async () => {
    const all = await db.movimentos.toArray();
    return new Set(all.map(m => m.operacaoRelacionada));
  }, []);

  const allLinhas = useLiveQuery(
    async () => {
      if (!conciliadosSet) return [];

      const extratos = await db.extratos
        .filter(ext => {
          if (!isDateInRange(ext.releaseDate, startDate, endDate)) return false;
          if (statusFilter !== 'all') {
            const isAnalitico = conciliadosSet.has(ext.referenceId);
            if (statusFilter === 'analitico' && !isAnalitico) return false;
            if (statusFilter === 'pendente' && isAnalitico) return false;
          }
          return true;
        })
        .toArray();

      const linhas: LinhaAjustada[] = [];

      for (const extrato of extratos) {
        const movimentos = await db.movimentos
          .where('operacaoRelacionada')
          .equals(extrato.referenceId)
          .toArray();

        const isConciliado = movimentos.length > 0;

        let totalMovimento: number | null = null;
        if (isConciliado) {
          totalMovimento = movimentos.reduce((sum, m) => sum + m.valor, 0);
          totalMovimento = Math.round(totalMovimento * 100) / 100;
        }

        linhas.push({
          id: extrato.id,
          dataLancamento: extrato.releaseDate,
          tipoExtrato: extrato.transactionType,
          referenceId: extrato.referenceId,
          valorLiquidoExtrato: extrato.transactionNetAmount,
          saldoParcial: extrato.partialBalance,
          statusConciliacao: isConciliado ? 'Conciliado' : 'Sem correspondência no Movimento',
          totalMovimento,
          isConciliado,
        });
      }

      // Ordenação
      return linhas.sort((a, b) => {
        let valA: any = a[sortConfig.key];
        let valB: any = b[sortConfig.key];

        if (sortConfig.key === 'dataLancamento') {
          const parseDate = (d: string) => {
            if (typeof d === 'string' && d.includes('-')) {
              const parts = d.split('-');
              if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return d;
          };
          valA = parseDate(valA);
          valB = parseDate(valB);
        }

        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    },
    [startDate, endDate, statusFilter, conciliadosSet, sortConfig]
  );

  const totalItems = allLinhas?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const linhasPagina = allLinhas?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };

  const requestSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUp className="w-3 h-3 ml-1 text-gray-300" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  const formatBR = (v: number | null | undefined): string => {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Totalizadores do rodapé
  const totalConciliados = allLinhas?.filter(l => l.isConciliado).length ?? 0;
  const totalSemCorrespondencia = allLinhas?.filter(l => !l.isConciliado).length ?? 0;
  const somaValorExtrato = allLinhas?.reduce((s, l) => s + l.valorLiquidoExtrato, 0) ?? 0;
  const somaMovimento = allLinhas?.reduce((s, l) => s + (l.totalMovimento ?? 0), 0) ?? 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Painel de Extrato Ajustado</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Uma linha por Reference ID — movimentos pivotados por tipo de operação
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Filtro de Status */}
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as any)}
              className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 px-2 py-1 bg-white"
            >
              <option value="all">Todos os Status</option>
              <option value="analitico">Somente Conciliados</option>
              <option value="pendente">Somente Sem Correspondência</option>
            </select>
          </div>

          {/* Filtro de Data */}
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
              title="Data inicial"
            />
            <span className="text-gray-500 text-sm">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
              title="Data final"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { onStartDateChange(''); onEndDateChange(''); }}
                className="text-gray-400 hover:text-red-500 ml-1"
                title="Limpar filtro de data"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      {totalItems > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalItems}</div>
            <div className="text-xs text-blue-600 mt-0.5">Total Lançamentos</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{totalConciliados}</div>
            <div className="text-xs text-green-600 mt-0.5">Conciliados</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{totalSemCorrespondencia}</div>
            <div className="text-xs text-orange-600 mt-0.5">Sem Correspondência</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-sm font-bold text-gray-700">R$ {formatBR(somaValorExtrato)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Extrato</div>
            <div className="text-sm font-bold text-gray-600">R$ {formatBR(somaMovimento)}</div>
            <div className="text-xs text-gray-500">Total Movimento</div>
          </div>
        </div>
      )}

      {totalItems === 0 ? (
        <p className="text-gray-500 text-center py-12">
          Nenhum registro encontrado para este filtro.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('statusConciliacao')}>
                    <div className="flex items-center">Status {getSortIcon('statusConciliacao')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('dataLancamento')}>
                    <div className="flex items-center">Data Lançamento {getSortIcon('dataLancamento')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('tipoExtrato')}>
                    <div className="flex items-center">Tipo (Extrato) {getSortIcon('tipoExtrato')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('referenceId')}>
                    <div className="flex items-center">Reference ID {getSortIcon('referenceId')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => requestSort('valorLiquidoExtrato')}>
                    <div className="flex items-center">Valor Líquido (Extrato) {getSortIcon('valorLiquidoExtrato')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => requestSort('totalMovimento')}>
                    <div className="flex items-center">Total Movimento {getSortIcon('totalMovimento')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhasPagina?.map((linha) => (
                  <tr
                    key={linha.id}
                    className={`border-b transition-colors ${
                      linha.isConciliado
                        ? 'bg-white hover:bg-blue-50'
                        : 'bg-orange-50 hover:bg-orange-100'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {linha.isConciliado ? (
                        <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Conciliado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Sem Correspondência
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-700">
                      {linha.dataLancamento}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate" title={linha.tipoExtrato}>
                      {linha.tipoExtrato}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                      {linha.referenceId}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap text-right">
                      R$ {formatBR(linha.valorLiquidoExtrato)}
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap text-right ${
                      linha.totalMovimento != null
                        ? Math.abs((linha.totalMovimento ?? 0) - linha.valorLiquidoExtrato) < 0.02
                          ? 'text-green-700'
                          : 'text-amber-700'
                        : 'text-gray-400'
                    }`}>
                      {linha.totalMovimento != null ? `R$ ${formatBR(linha.totalMovimento)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-700">
              Página{' '}
              <span className="font-semibold text-gray-900">{currentPage}</span> de{' '}
              <span className="font-semibold text-gray-900">{totalPages}</span>
              <span className="ml-2 text-gray-500">({totalItems} lançamentos no total)</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
