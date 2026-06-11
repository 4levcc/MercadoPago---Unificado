import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Movimento } from '../db';
import { ChevronLeft, ChevronRight, Check, ArrowUp, ArrowDown } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export function MovimentoPanel() {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Movimento | 'conciliado'; direction: 'asc' | 'desc' }>({ 
    key: 'dataPagamento', 
    direction: 'desc' 
  });
  
  const extratosRefIds = useLiveQuery(async () => {
    const all = await db.extratos.toArray();
    return new Set(all.map(e => e.referenceId));
  }, []);

  const allFilteredMovimentos = useLiveQuery(
    async () => {
      const arr = await db.movimentos.toArray();
      
      return arr.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'conciliado') {
          valA = extratosRefIds?.has(a.operacaoRelacionada) ? 1 : 0;
          valB = extratosRefIds?.has(b.operacaoRelacionada) ? 1 : 0;
        } else {
          valA = a[sortConfig.key];
          valB = b[sortConfig.key];
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    },
    [sortConfig, extratosRefIds]
  );

  const totalItems = allFilteredMovimentos?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const movimentos = allFilteredMovimentos?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Removido useEffect assíncrono para evitar loop infinito

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const requestSort = (key: keyof Movimento | 'conciliado') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Movimento | 'conciliado') => {
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
        <h2 className="text-xl font-semibold text-gray-800">Painel de Movimento</h2>
        
        <div className="flex items-center gap-2">
        </div>
      </div>
      
      {totalItems === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhum registro de movimento encontrado.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('conciliado')}>
                    <div className="flex items-center">Conciliado {getSortIcon('conciliado')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('dataPagamento')}>
                    <div className="flex items-center">Data de Pagamento {getSortIcon('dataPagamento')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Tipo de Operação
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Nº Movimento
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('operacaoRelacionada')}>
                    <div className="flex items-center">Operação Relacionada {getSortIcon('operacaoRelacionada')}</div>
                  </th>
                  <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => requestSort('valor')}>
                    <div className="flex items-center">Valor {getSortIcon('valor')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {movimentos?.map((mov) => {
                  const isConciliado = extratosRefIds?.has(mov.operacaoRelacionada);
                  
                  return (
                    <tr key={mov.numeroMovimento} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {isConciliado && (
                          <div className="flex items-center text-green-600 font-medium" title="Registro consta no Extrato">
                            <Check className="w-5 h-5 mr-1" />
                            Conciliado
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{mov.dataPagamento}</td>
                      <td className="px-6 py-4">{mov.tipoOperacao}</td>
                      <td className="px-6 py-4">{mov.numeroMovimento}</td>
                      <td className="px-6 py-4">{mov.operacaoRelacionada}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        R$ {mov.valor.toFixed(2)}
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
