import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Extrato } from '../db';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Filter, X, ArrowUp, ArrowDown } from 'lucide-react';
import { isDateInRange } from '../utils/date';

const ITEMS_PER_PAGE = 20;

interface ExtratoPanelProps {
  startDate: string;
  endDate: string;
  statusFilter: 'all' | 'analitico' | 'pendente';
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStatusFilterChange: (status: 'all' | 'analitico' | 'pendente') => void;
}

export function ExtratoPanel({ 
  startDate, endDate, statusFilter, 
  onStartDateChange, onEndDateChange, onStatusFilterChange 
}: ExtratoPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [conciliadosSet, setConciliadosSet] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof Extrato | 'status'; direction: 'asc' | 'desc' }>({ 
    key: 'releaseDate', 
    direction: 'desc' 
  });
  
  // Reseta a paginação quando o filtro muda
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, statusFilter]);

  // Carrega todos os movimentos apenas para extrair os IDs de relacionamento de forma síncrona para o filtro
  useLiveQuery(async () => {
    const allMovimentos = await db.movimentos.toArray();
    const ids = new Set(allMovimentos.map(m => m.operacaoRelacionada));
    setConciliadosSet(ids);
  }, []);

  const allFilteredExtratos = useLiveQuery(
    async () => {
      const arr = await db.extratos
        .filter(ext => {
          // 1. Filtro de data
          if (!isDateInRange(ext.releaseDate, startDate, endDate)) return false;
          
          // 2. Filtro de status
          if (statusFilter !== 'all') {
            const isAnalitico = conciliadosSet.has(ext.referenceId);
            if (statusFilter === 'analitico' && !isAnalitico) return false;
            if (statusFilter === 'pendente' && isAnalitico) return false;
          }
          
          return true;
        })
        .toArray();
        
      return arr.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'status') {
          valA = conciliadosSet.has(a.referenceId);
          valB = conciliadosSet.has(b.referenceId);
        } else {
          valA = a[sortConfig.key];
          valB = b[sortConfig.key];
        }

        // Tratamento especial para datas no formato DD-MM-YYYY
        const parseDate = (d: string) => {
          if (typeof d === 'string' && d.includes('-')) {
            const parts = d.split('-');
            if (parts[0].length === 2) {
               return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          return d;
        };

        if (sortConfig.key === 'releaseDate') {
          valA = parseDate(valA);
          valB = parseDate(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    },
    [startDate, endDate, statusFilter, conciliadosSet, sortConfig]
  );

  const totalItems = allFilteredExtratos?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const extratos = allFilteredExtratos?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Removido useEffect assíncrono para status

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const requestSort = (key: keyof Extrato | 'status') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Extrato | 'status') => {
    if (sortConfig.key !== key) {
      return <ArrowUp className="w-3 h-3 ml-1 text-gray-300" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Painel de Extrato</h2>
        
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as any)}
              className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 px-2 py-1 bg-white"
            >
              <option value="all">Todos os Status</option>
              <option value="analitico">Somente Analíticos</option>
              <option value="pendente">Somente Pendentes</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex items-center gap-2">
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
      </div>
      
      {totalItems === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhum registro de extrato encontrado para este filtro.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('status')}>
                    <div className="flex items-center">Status {getSortIcon('status')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('releaseDate')}>
                    <div className="flex items-center">Data (Release) {getSortIcon('releaseDate')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Tipo de Transação
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('referenceId')}>
                    <div className="flex items-center">Reference ID {getSortIcon('referenceId')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => requestSort('transactionNetAmount')}>
                    <div className="flex items-center">Valor Líquido {getSortIcon('transactionNetAmount')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {extratos?.map((extrato) => {
                  const isConciliado = conciliadosSet.has(extrato.referenceId);
                  
                  return (
                    <tr key={extrato.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">
                        {isConciliado ? (
                          <span className="flex items-center text-blue-600" title="Analítico - Encontrado no Movimento">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Analítico</span>
                          </span>
                        ) : (
                          <span className="flex items-center text-gray-400" title="Pendente - Apenas valor líquido">
                            <Clock className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Pendente</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{extrato.releaseDate}</td>
                      <td className="px-6 py-4">{extrato.transactionType}</td>
                      <td className="px-6 py-4">{extrato.referenceId}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        R$ {extrato.transactionNetAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-700">
              Mostrando página <span className="font-semibold text-gray-900">{currentPage}</span> de <span className="font-semibold text-gray-900">{totalPages}</span> 
              <span className="ml-2 text-gray-500">({totalItems} registros no total)</span>
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
