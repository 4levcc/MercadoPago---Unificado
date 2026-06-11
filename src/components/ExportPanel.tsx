import React, { useState } from 'react';
import { LayoutPanelLeft, ListTree, Loader2 } from 'lucide-react';
import { exportToXlsx } from '../services/exportService';

export const ExportPanel: React.FC = () => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pivotado' | 'auditoria' | 'cronologico') => {
    setExporting(true);
    try {
      await exportToXlsx(format);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao gerar exportação. Verifique o console.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Exportar Relatórios</h3>
          <p className="text-sm text-gray-500">Escolha o formato da planilha XLSX gerada.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => handleExport('pivotado')}
          disabled={exporting}
          className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
        >
          <div className="p-2 bg-primary-100 text-primary-700 rounded-md">
            <LayoutPanelLeft className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center">
              Analítico Pivotado (Horizontal)
              {exporting && <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary-500" />}
            </h4>
            <p className="text-xs text-gray-500 mt-1">1 linha por venda, tarifas em colunas consolidadas.</p>
          </div>
        </button>

        <button 
          onClick={() => handleExport('auditoria')}
          disabled={exporting}
          className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
        >
          <div className="p-2 bg-primary-100 text-primary-700 rounded-md">
            <ListTree className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center">
              Analítico Auditoria (Vertical)
              {exporting && <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary-500" />}
            </h4>
            <p className="text-xs text-gray-500 mt-1">Visão em blocos: Extrato original, Movimentos abaixo e Total.</p>
          </div>
        </button>

        <button 
          onClick={() => handleExport('cronologico')}
          disabled={exporting}
          className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
        >
          <div className="p-2 bg-primary-100 text-primary-700 rounded-md">
            <ListTree className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center">
              Analítico Cronológico (Vertical)
              {exporting && <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary-500" />}
            </h4>
            <p className="text-xs text-gray-500 mt-1">Formato contínuo: Apenas movimentos alinhados pela data para soma exata no Excel.</p>
          </div>
        </button>
      </div>
    </div>
  );
};
