import React, { useState, useMemo } from 'react';
import {
  UploadCloud, CheckCircle, AlertCircle, Loader2, FileSpreadsheet,
  ListOrdered, AlertTriangle, Download, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, CheckSquare
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ParsedRow {
  data: string;
  tipoOperacao: string;
  operacaoRelacionada: string;
  valor: number;
  numeroMov: string;
  status: string;
  categoria: string;      // mapped from Plano de Contas
  hasCategoryMatch: boolean;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Inner table for previewing rows
// ─────────────────────────────────────────────────────────────────────────────
type SortKey = 'data' | 'tipoOperacao' | 'operacaoRelacionada' | 'valor' | 'categoria';

const PreviewTable: React.FC<{ rows: ParsedRow[] }> = ({ rows }) => {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'data', direction: 'asc'
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

  const handleSort = (key: SortKey) => {
    setSortConfig(cur => ({
      key,
      direction: cur.key === key && cur.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
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
                  onClick={() => handleSort('data')}>
                <div className="flex items-center">Data <SortIcon col="data" /></div>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('tipoOperacao')}>
                <div className="flex items-center">Tipo de Operação <SortIcon col="tipoOperacao" /></div>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('operacaoRelacionada')}>
                <div className="flex items-center">Operação Relacionada <SortIcon col="operacaoRelacionada" /></div>
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('valor')}>
                <div className="flex items-center justify-end">Valor <SortIcon col="valor" /></div>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('categoria')}>
                <div className="flex items-center">Categoria (Tiny) <SortIcon col="categoria" /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row, idx) => (
              <tr key={idx} className={`border-b border-gray-50 hover:bg-gray-50 ${!row.hasCategoryMatch ? 'bg-orange-50/50' : ''}`}>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.data}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={row.tipoOperacao}>
                  {row.tipoOperacao}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.operacaoRelacionada}</td>
                <td className={`px-4 py-3 text-right font-medium ${
                  row.valor < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  R$ {row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  {row.hasCategoryMatch ? (
                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                      <CheckSquare className="w-3 h-3 mr-1" />{row.categoria}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
                      <AlertTriangle className="w-3 h-3 mr-1" />Sem Plano de Contas
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-gray-100 bg-gray-50">
          <span className="text-sm text-gray-500">
            Página {page + 1} de {totalPages} · {rows.length} registros
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
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export const TinyExportPanel: React.FC = () => {
  const [extratoStatus, setExtratoStatus] = useState<{ loading: boolean; message: string; type: 'idle' | 'success' | 'error' }>({ loading: false, message: '', type: 'idle' });
  const [planoStatus, setPlanoStatus] = useState<{ loading: boolean; message: string; type: 'idle' | 'success' | 'error' }>({ loading: false, message: '', type: 'idle' });

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [planoMap, setPlanoMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const [previewTab, setPreviewTab] = useState<'geral' | 'revisao'>('geral');

  // ─── File readers ────────────────────────────────────────────────────────
  const readFile = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

  // ─── Upload: Plano de Contas ──────────────────────────────────────────────
  const handlePlanoUpload = async (file: File) => {
    setPlanoStatus({ loading: true, message: 'Processando...', type: 'idle' });
    try {
      const buffer = await readFile(file);
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];

      const map: Record<string, string> = {};
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[0] && row[1]) {
          map[String(row[0]).trim()] = String(row[1]).trim();
        }
      }

      setPlanoMap(map);
      setPlanoStatus({ loading: false, message: `Plano importado. ${Object.keys(map).length} mapeamentos.`, type: 'success' });

      // Re-map existing rows if extrato was uploaded first
      setParsedRows(prev => prev.map(r => {
        const cat = map[r.tipoOperacao] ?? '';
        return { ...r, categoria: cat, hasCategoryMatch: !!cat };
      }));
    } catch (err) {
      setPlanoStatus({ loading: false, message: `Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, type: 'error' });
    }
  };

  // ─── Upload: Extrato Analítico ────────────────────────────────────────────
  const handleExtratoUpload = async (file: File) => {
    setExtratoStatus({ loading: true, message: 'Processando...', type: 'idle' });
    try {
      const buffer = await readFile(file);
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];

      const rows: ParsedRow[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 5) continue;

        const tipoOperacao = String(row[1] ?? '').trim();
        const cat = planoMap[tipoOperacao] ?? '';

        rows.push({
          data: String(row[0] ?? '').trim(),
          tipoOperacao,
          operacaoRelacionada: String(row[2] ?? '').trim(),
          valor: typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3]).replace(',', '.')) || 0,
          numeroMov: String(row[4] ?? '').trim(),
          status: String(row[5] ?? '').trim(),
          categoria: cat,
          hasCategoryMatch: !!cat,
        });
      }

      setParsedRows(rows);
      setExtratoStatus({ loading: false, message: `Extrato importado. ${rows.length} linhas processadas.`, type: 'success' });
    } catch (err) {
      setExtratoStatus({ loading: false, message: `Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, type: 'error' });
    }
  };

  // ─── File input handler (supports both click and drag) ─────────────────────
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, handler: (file: File) => void) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
  };

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const mapped = parsedRows.filter(r => r.hasCategoryMatch).length;
    const unmapped = total - mapped;
    return { total, mapped, unmapped, planoCount: Object.keys(planoMap).length };
  }, [parsedRows, planoMap]);

  const reviewRows = useMemo(() => parsedRows.filter(r => !r.hasCategoryMatch), [parsedRows]);

  // ─── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (parsedRows.length === 0) return;
    setExporting(true);

    try {
      const tinyRows: TinyRow[] = parsedRows.map(r => ({
        Data: r.data,
        Categoria: r.categoria,
        'Histórico': r.tipoOperacao,
        Tipo: '',
        Valor: r.valor,
        ID: `${r.numeroMov} ${r.operacaoRelacionada}`.trim(),
        Contato: '',
        CNPJ: '',
        Marcadores: '',
        Conta: '',
        'Nº do documento': '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(tinyRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Extrato MP - Tiny');

      // Month/Year suffix
      const monthYears = new Set<string>();
      parsedRows.forEach(r => {
        const parts = r.data.split(/[-/]/);
        if (parts.length === 3) {
          let month, year;
          if (parts[0].length === 4) { year = parts[0]; month = parts[1]; }
          else if (parts[2].length === 4) { month = parts[1]; year = parts[2]; }
          if (month && year) monthYears.add(`${month}${year}`);
        }
      });
      const suffix = monthYears.size > 0 ? ` - ${Array.from(monthYears).sort().join(' ')}` : '';
      XLSX.writeFile(wb, `Extrato MP - Tiny${suffix}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // ─── Tab definitions ──────────────────────────────────────────────────────
  const PREVIEW_TABS: { key: 'geral' | 'revisao'; label: string }[] = [
    { key: 'geral', label: 'Geral' },
    { key: 'revisao', label: 'Revisão' },
  ];

  const tabCounts = {
    geral: parsedRows.length,
    revisao: reviewRows.length,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ─── Block 1: Importação de Dados ───────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">1. Importação de Dados</h2>
          <p className="text-sm text-gray-500">Carregue o Extrato Analítico gerado pela conciliação e o Plano de Contas.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
          {/* Extrato Upload */}
          <div className="flex-1 p-6 border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/50 relative hover:bg-primary-50 transition-colors">
            <input
              type="file"
              aria-label="Upload de Extrato Analítico"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileInput(e, handleExtratoUpload)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={extratoStatus.loading}
            />
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                {extratoStatus.loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Extrato Analítico</h3>
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

          {/* Plano de Contas Upload */}
          <div className="flex-1 p-6 border-2 border-dashed border-secondary-200 rounded-xl bg-secondary-50/50 relative hover:bg-secondary-50 transition-colors">
            <input
              type="file"
              aria-label="Upload de Plano de Contas"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileInput(e, handlePlanoUpload)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={planoStatus.loading}
            />
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center">
                {planoStatus.loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Plano de Contas</h3>
                <p className="text-sm text-gray-500 mt-1">Selecione ou arraste a planilha (XLSX)</p>
              </div>
              {planoStatus.message && (
                <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-md ${
                  planoStatus.type === 'success' ? 'text-green-700 bg-green-100' :
                  planoStatus.type === 'error' ? 'text-red-700 bg-red-100' : 'text-gray-500'
                }`}>
                  {planoStatus.type === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {planoStatus.type === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                  {planoStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Block 2: Análise da Importação ─────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">2. Análise da Importação</h2>
          <p className="text-sm text-gray-500">Visão geral dos dados importados e mapeamento com o Plano de Contas.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 leading-tight">Linhas Extrato</p>
              <h4 className="text-xl font-bold text-gray-900">{stats.total}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 leading-tight">Plano de Contas</p>
              <h4 className="text-xl font-bold text-gray-900">{stats.planoCount}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 leading-tight">Com Categoria</p>
              <h4 className="text-xl font-bold text-emerald-700">{stats.mapped}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 leading-tight">Sem Categoria</p>
              <h4 className="text-xl font-bold text-orange-600">{stats.unmapped}</h4>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Prévia dos Dados</h3>
            <span className="text-sm text-gray-500">{parsedRows.length} registros importados</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            {PREVIEW_TABS.map(tab => {
              const count = tabCounts[tab.key];
              const isActive = previewTab === tab.key;
              const badgeColor =
                tab.key === 'revisao' ? 'bg-orange-100 text-orange-700' :
                'bg-primary-100 text-primary-700';

              return (
                <button
                  key={tab.key}
                  onClick={() => setPreviewTab(tab.key)}
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
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <PreviewTable rows={previewTab === 'geral' ? parsedRows : reviewRows} />
        </div>
      </section>

      {/* ─── Block 3: Geração de Relatório Tiny ─────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">3. Geração de Relatório Tiny</h2>
          <p className="text-sm text-gray-500">Exporte o arquivo no layout do Tiny ERP.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Exportar Relatório</h3>
              <p className="text-sm text-gray-500">Gere o arquivo XLSX no layout de importação do Tiny.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleExport}
              disabled={parsedRows.length === 0 || exporting}
              className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-2 bg-primary-100 text-primary-700 rounded-md">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 flex items-center">
                  Extrato MP - Tiny
                  {exporting && <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary-500" />}
                </h4>
                <p className="text-xs text-gray-500 mt-1">Layout para importação direta no Tiny ERP.</p>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
