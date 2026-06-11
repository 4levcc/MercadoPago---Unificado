import { useRef, useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../db';
import type { Extrato, Movimento } from '../db';

export function FileUpload() {
  const [extratoStatus, setExtratoStatus] = useState<string>('');
  const [movimentoStatus, setMovimentoStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const extratoInputRef = useRef<HTMLInputElement>(null);
  const movimentoInputRef = useRef<HTMLInputElement>(null);

  const handleExtratoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setExtratoStatus('Processando...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Pular as 3 primeiras linhas de cabeçalho do Extrato
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { range: 3 });

      const parseBrNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/\./g, '').replace(',', '.');
        return Number(str) || 0;
      };

      const extratosToSave: Extrato[] = jsonData
        .filter((row) => row['REFERENCE_ID'] && row['RELEASE_DATE'])
        .map((row) => ({
          id: `${row['REFERENCE_ID']}_${row['TRANSACTION_TYPE']}_${row['RELEASE_DATE']}`,
          releaseDate: row['RELEASE_DATE'],
          transactionType: row['TRANSACTION_TYPE'] || '',
          referenceId: String(row['REFERENCE_ID']),
          transactionNetAmount: parseBrNumber(row['TRANSACTION_NET_AMOUNT']),
          partialBalance: parseBrNumber(row['PARTIAL_BALANCE']),
        }));

      // bulkPut ignora duplicatas de ID atualizando-as
      await db.extratos.bulkPut(extratosToSave);
      setExtratoStatus(`Sucesso! ${extratosToSave.length} registros processados.`);
    } catch (err) {
      console.error(err);
      setExtratoStatus('Erro ao processar arquivo de Extrato.');
    } finally {
      setIsProcessing(false);
      if (extratoInputRef.current) extratoInputRef.current.value = '';
    }
  };

  const handleMovimentoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMovimentoStatus('Processando...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Movimento normalmente não precisa pular linhas
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      const movimentosToSave: Movimento[] = jsonData
        .filter((row) => row['Número do movimento'])
        .map((row) => ({
          numeroMovimento: String(row['Número do movimento']),
          dataPagamento: row['Data de pagamento'] || '',
          tipoOperacao: row['Tipo de operação'] || '',
          operacaoRelacionada: String(row['Operação relacionada'] || ''),
          valor: Number(row['Valor']) || 0,
        }));

      await db.movimentos.bulkPut(movimentosToSave);
      setMovimentoStatus(`Sucesso! ${movimentosToSave.length} registros processados.`);
    } catch (err) {
      console.error(err);
      setMovimentoStatus('Erro ao processar arquivo de Movimento.');
    } finally {
      setIsProcessing(false);
      if (movimentoInputRef.current) movimentoInputRef.current.value = '';
    }
  };

  const handleClearDB = async () => {
    if (confirm('Tem certeza que deseja apagar todos os dados do navegador?')) {
      await db.extratos.clear();
      await db.movimentos.clear();
      setExtratoStatus('');
      setMovimentoStatus('');
      alert('Banco de dados limpo com sucesso.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Importação de Arquivos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload de Extrato */}
        <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
          <UploadCloud className="w-10 h-10 text-blue-500 mb-2" />
          <h3 className="font-medium text-gray-700">Arquivo de Extrato</h3>
          <p className="text-sm text-gray-500 mb-4">Selecione o arquivo Extrato .xlsx</p>
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded cursor-pointer transition-colors">
            {isProcessing ? 'Processando...' : 'Selecionar Extrato'}
            <input 
              ref={extratoInputRef}
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              onChange={handleExtratoUpload} 
              disabled={isProcessing}
            />
          </label>
          {extratoStatus && (
            <div className={`mt-3 text-sm flex items-center gap-1 ${extratoStatus.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>
              {extratoStatus.includes('Erro') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {extratoStatus}
            </div>
          )}
        </div>

        {/* Upload de Movimento */}
        <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
          <UploadCloud className="w-10 h-10 text-purple-500 mb-2" />
          <h3 className="font-medium text-gray-700">Arquivo de Movimento</h3>
          <p className="text-sm text-gray-500 mb-4">Selecione o arquivo Movimento .xlsx</p>
          <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded cursor-pointer transition-colors">
            {isProcessing ? 'Processando...' : 'Selecionar Movimento'}
            <input 
              ref={movimentoInputRef}
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              onChange={handleMovimentoUpload}
              disabled={isProcessing}
            />
          </label>
          {movimentoStatus && (
            <div className={`mt-3 text-sm flex items-center gap-1 ${movimentoStatus.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>
              {movimentoStatus.includes('Erro') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {movimentoStatus}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={handleClearDB}
          className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors"
        >
          Limpar Banco de Dados
        </button>
      </div>
    </div>
  );
}
