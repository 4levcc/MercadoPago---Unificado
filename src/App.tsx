import { useState } from 'react';
import { UploadPanel } from './components/UploadPanel';
import { DashboardStats } from './components/DashboardStats';
import { TransactionsTable } from './components/TransactionsTable';
import { ExportPanel } from './components/ExportPanel';
import { TinyExportPanel } from './components/TinyExportPanel';
import { processReconciliation } from './services/exportService';
import { Activity, RefreshCcw, Trash2 } from 'lucide-react';
import { db } from './db/database';

type AppTab = 'conciliacao' | 'tiny';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('conciliacao');
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastImportCounts, setLastImportCounts] = useState<{extrato?: number, movimento?: number}>({});

  const handleUploadSuccess = (type: 'extrato' | 'movimento', count: number) => {
    setLastImportCounts(prev => ({ ...prev, [type]: count }));
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      // processReconciliation updates the DB status for each row
      await processReconciliation();
    } catch (error) {
      console.error('Erro na conciliação:', error);
      alert('Erro ao realizar a conciliação dos dados.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleClearDb = async () => {
    if (window.confirm('Tem certeza que deseja apagar todos os dados do banco local? Isso não pode ser desfeito.')) {
      try {
        await db.extratos.clear();
        await db.movimentos.clear();
        setLastImportCounts({});
      } catch (error) {
        console.error('Erro ao limpar banco:', error);
        alert('Erro ao limpar o banco de dados.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">
              Conciliação Mercado Pago
            </h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            Encorda
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('conciliacao')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conciliacao'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Conciliação MP
            </button>
            <button
              onClick={() => setActiveTab('tiny')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tiny'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Exportação Tiny
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {activeTab === 'conciliacao' && (
          <>
            {/* Section 1: Upload */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900">1. Importação de Dados</h2>
                <p className="text-sm text-gray-500">Carregue as planilhas oficiais exportadas pelo Mercado Pago.</p>
              </div>
              <UploadPanel onUploadSuccess={handleUploadSuccess} />
            </section>

            {/* Section 2: Dashboard & Actions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">2. Análise e Conciliação</h2>
                  <p className="text-sm text-gray-500">Visão geral dos dados armazenados no banco local.</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={handleClearDb}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Limpar Banco</span>
                  </button>
                  <button 
                    onClick={handleReconcile}
                    disabled={isReconciling}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-4 h-4 ${isReconciling ? 'animate-spin' : ''}`} />
                    <span>{isReconciling ? 'Processando...' : 'Rodar Conciliação'}</span>
                  </button>
                </div>
              </div>
              
              <DashboardStats lastImportCounts={lastImportCounts} />
            </section>

            {/* Section 3: Data Grid */}
            <section>
              <TransactionsTable />
            </section>

            {/* Section 4: Export */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900">3. Geração de Relatórios</h2>
                <p className="text-sm text-gray-500">Exporte os resultados da conciliação.</p>
              </div>
              <ExportPanel />
            </section>
          </>
        )}

        {activeTab === 'tiny' && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Exportação para Tiny ERP</h2>
              <p className="text-sm text-gray-500">
                Faça upload do Extrato Analítico gerado pela conciliação e do Plano de Contas para gerar o arquivo no layout do Tiny.
              </p>
            </div>
            <TinyExportPanel />
          </section>
        )}

      </main>
    </div>
  );
}

export default App;

