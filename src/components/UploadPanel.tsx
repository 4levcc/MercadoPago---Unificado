import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { importExtrato, importMovimento } from '../services/importService';

export const UploadPanel: React.FC<{ onUploadSuccess: (type: 'extrato' | 'movimento', count: number) => void }> = ({ onUploadSuccess }) => {
  const [extratoStatus, setExtratoStatus] = useState<{ loading: boolean; message: string; type: 'idle' | 'success' | 'error' }>({ loading: false, message: '', type: 'idle' });
  const [movimentoStatus, setMovimentoStatus] = useState<{ loading: boolean; message: string; type: 'idle' | 'success' | 'error' }>({ loading: false, message: '', type: 'idle' });

  const handleExtratoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setExtratoStatus({ loading: true, message: 'Processando...', type: 'idle' });
    const result = await importExtrato(file);
    setExtratoStatus({
      loading: false,
      message: result.message,
      type: result.success ? 'success' : 'error'
    });
    if (result.success) onUploadSuccess('extrato', result.rowsProcessed);
  };

  const handleMovimentoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMovimentoStatus({ loading: true, message: 'Processando...', type: 'idle' });
    const result = await importMovimento(file);
    setMovimentoStatus({
      loading: false,
      message: result.message,
      type: result.success ? 'success' : 'error'
    });
    if (result.success) onUploadSuccess('movimento', result.rowsProcessed);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
      {/* Extrato Upload */}
      <div className="flex-1 p-6 border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/50 relative hover:bg-primary-50 transition-colors">
        <input 
          type="file" 
          aria-label="Upload de Extrato de Contas"
          accept=".xlsx, .xls" 
          onChange={handleExtratoUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={extratoStatus.loading}
        />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
            {extratoStatus.loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Extrato de Contas</h3>
            <p className="text-sm text-gray-500 mt-1">Selecione ou arraste a planilha (XLSX)</p>
          </div>
          {extratoStatus.message && (
            <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-md ${
              extratoStatus.type === 'success' ? 'text-green-700 bg-green-100' : 
              extratoStatus.type === 'error' ? 'text-red-700 bg-red-100' : 'text-gray-500'
            }`}>
              {extratoStatus.type === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
              {extratoStatus.type === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {extratoStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Movimento Upload */}
      <div className="flex-1 p-6 border-2 border-dashed border-secondary-200 rounded-xl bg-secondary-50/50 relative hover:bg-secondary-50 transition-colors">
        <input 
          type="file" 
          aria-label="Upload de Movimento Financeiro"
          accept=".xlsx, .xls" 
          onChange={handleMovimentoUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={movimentoStatus.loading}
        />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center">
            {movimentoStatus.loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Movimento Financeiro</h3>
            <p className="text-sm text-gray-500 mt-1">Selecione ou arraste a planilha (XLSX)</p>
          </div>
          {movimentoStatus.message && (
            <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-md ${
              movimentoStatus.type === 'success' ? 'text-green-700 bg-green-100' : 
              movimentoStatus.type === 'error' ? 'text-red-700 bg-red-100' : 'text-gray-500'
            }`}>
              {movimentoStatus.type === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
              {movimentoStatus.type === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {movimentoStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
