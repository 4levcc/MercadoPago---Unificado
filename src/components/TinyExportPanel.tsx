import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TinyRow {
  Data: string;
  Categoria: string;
  'Histórico': string;
  Tipo: string;
  Valor: number;
  ID: string;
  Contato: string;
  CNPJ: string;
  Marcadores: string;
  Conta: string;
  'Nº do documento': string;
}

export const TinyExportPanel: React.FC = () => {
  const [extratoFile, setExtratoFile] = useState<File | null>(null);
  const [planoFile, setPlanoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; warnings: string[] } | null>(null);
  const extratoInputRef = useRef<HTMLInputElement>(null);
  const planoInputRef = useRef<HTMLInputElement>(null);

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleProcess = async () => {
    if (!extratoFile || !planoFile) return;

    setProcessing(true);
    setResult(null);

    try {
      // 1. Ler o Plano de Contas
      const planoBuffer = await readFileAsArrayBuffer(planoFile);
      const planoWb = XLSX.read(planoBuffer, { type: 'array' });
      const planoWs = planoWb.Sheets[planoWb.SheetNames[0]];
      const planoData = XLSX.utils.sheet_to_json<any[]>(planoWs, { header: 1 }) as any[][];

      // Montar mapa Descrição → Plano de Contas (pular cabeçalho)
      const planoMap: Record<string, string> = {};
      for (let i = 1; i < planoData.length; i++) {
        const row = planoData[i];
        if (row[0] && row[1]) {
          planoMap[String(row[0]).trim()] = String(row[1]).trim();
        }
      }

      // 2. Ler o Extrato Analítico
      const extratoBuffer = await readFileAsArrayBuffer(extratoFile);
      const extratoWb = XLSX.read(extratoBuffer, { type: 'array' });
      const extratoWs = extratoWb.Sheets[extratoWb.SheetNames[0]];
      const extratoData = XLSX.utils.sheet_to_json<any[]>(extratoWs, { header: 1 }) as any[][];

      // 3. Processar cada linha (pular cabeçalho)
      const tinyRows: TinyRow[] = [];
      const warnings: string[] = [];
      const unmappedTypes = new Set<string>();

      for (let i = 1; i < extratoData.length; i++) {
        const row = extratoData[i];
        if (!row || row.length < 5) continue;

        const dataLancamento = String(row[0] ?? '').trim();
        const tipoOperacao = String(row[1] ?? '').trim();
        const operacaoRelacionada = String(row[2] ?? '').trim();
        const valor = typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3]).replace(',', '.')) || 0;
        const numeroMov = String(row[4] ?? '').trim();

        // Buscar categoria no Plano de Contas
        const categoria = planoMap[tipoOperacao] ?? '';
        if (!categoria && tipoOperacao) {
          unmappedTypes.add(tipoOperacao);
        }

        // Montar o ID: "NúmeroMov OperaçãoRelacionada"
        const id = `${numeroMov} ${operacaoRelacionada}`.trim();

        tinyRows.push({
          Data: dataLancamento,
          Categoria: categoria,
          'Histórico': tipoOperacao,
          Tipo: '',
          Valor: valor,
          ID: id,
          Contato: '',
          CNPJ: '',
          Marcadores: '',
          Conta: '',
          'Nº do documento': '',
        });
      }

      // Avisos de tipos não mapeados
      if (unmappedTypes.size > 0) {
        unmappedTypes.forEach(t => {
          warnings.push(`Tipo de Operação "${t}" não encontrado no Plano de Contas.`);
        });
      }

      // 4. Gerar o XLSX de saída
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(tinyRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Extrato MP - Tiny');

      // Extrair mês/ano do nome do arquivo ou das datas
      const monthYears = new Set<string>();
      tinyRows.forEach(r => {
        const dateStr = r.Data;
        if (!dateStr) return;
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
          let month, year;
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            year = parts[0];
            month = parts[1];
          } else if (parts[2].length === 4) {
            // DD-MM-YYYY
            month = parts[1];
            year = parts[2];
          }
          if (month && year) {
            monthYears.add(`${month}${year}`);
          }
        }
      });

      const monthYearSuffix = monthYears.size > 0 ? ` - ${Array.from(monthYears).sort().join(' ')}` : '';
      XLSX.writeFile(wb, `Extrato MP - Tiny${monthYearSuffix}.xlsx`);

      setResult({
        success: true,
        message: `Arquivo gerado com sucesso! ${tinyRows.length} linhas processadas.`,
        warnings,
      });
    } catch (error) {
      console.error('Erro ao processar Tiny:', error);
      setResult({
        success: false,
        message: `Erro ao processar os arquivos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        warnings: [],
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Extrato Analítico Upload */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            extratoFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
          }`}
          onClick={() => extratoInputRef.current?.click()}
        >
          <input
            ref={extratoInputRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setExtratoFile(e.target.files[0]);
                setResult(null);
              }
            }}
          />
          <div className="flex flex-col items-center space-y-3">
            <div className={`p-3 rounded-full ${extratoFile ? 'bg-green-100' : 'bg-primary-100'}`}>
              {extratoFile ? (
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              ) : (
                <Upload className="w-8 h-8 text-primary-600" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Extrato Analítico</h4>
              <p className="text-sm text-gray-500 mt-1">
                {extratoFile
                  ? `✓ ${extratoFile.name}`
                  : 'Selecione o arquivo Extrato Analítico (XLSX)'}
              </p>
            </div>
          </div>
        </div>

        {/* Plano de Contas Upload */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            planoFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
          }`}
          onClick={() => planoInputRef.current?.click()}
        >
          <input
            ref={planoInputRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setPlanoFile(e.target.files[0]);
                setResult(null);
              }
            }}
          />
          <div className="flex flex-col items-center space-y-3">
            <div className={`p-3 rounded-full ${planoFile ? 'bg-green-100' : 'bg-primary-100'}`}>
              {planoFile ? (
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              ) : (
                <Upload className="w-8 h-8 text-primary-600" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Plano de Contas</h4>
              <p className="text-sm text-gray-500 mt-1">
                {planoFile
                  ? `✓ ${planoFile.name}`
                  : 'Selecione o arquivo Plano de Contas (XLSX)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={handleProcess}
          disabled={!extratoFile || !planoFile || processing}
          className="flex items-center space-x-3 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Gerar Extrato MP - Tiny</span>
            </>
          )}
        </button>
      </div>

      {/* Result Feedback */}
      {result && (
        <div className={`p-4 rounded-xl border ${
          result.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.message}
              </p>
              {result.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-medium text-amber-700">⚠ Avisos:</p>
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-amber-600 ml-4">• {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
