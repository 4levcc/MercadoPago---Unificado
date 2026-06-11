import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ExtratoPanel } from './components/ExtratoPanel';
import { AjustadoPanel } from './components/AjustadoPanel';
import { MovimentoPanel } from './components/MovimentoPanel';
import { ExportButton } from './components/ExportButton';
import { LayoutDashboard, FileText, Activity, ClipboardList } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'extrato' | 'movimento' | 'ajustado'>('upload');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'analitico' | 'pendente'>('all');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">Conciliação Financeira</h1>
          </div>
          <ExportButton startDate={startDate} endDate={endDate} statusFilter={statusFilter} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <UploadIcon className="w-4 h-4" />
            Importação
          </button>
          
          <button
            onClick={() => setActiveTab('extrato')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'extrato'
                ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Painel de Extrato
          </button>

          <button
            onClick={() => setActiveTab('movimento')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'movimento'
                ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            Painel de Movimento
          </button>

          <button
            onClick={() => setActiveTab('ajustado')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'ajustado'
                ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Painel Ajustado
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'upload' && <FileUpload />}
          {activeTab === 'extrato' && (
            <ExtratoPanel 
              startDate={startDate} 
              endDate={endDate} 
              statusFilter={statusFilter}
              onStartDateChange={setStartDate} 
              onEndDateChange={setEndDate} 
              onStatusFilterChange={setStatusFilter}
            />
          )}
          {activeTab === 'ajustado' && (
            <AjustadoPanel 
              startDate={startDate} 
              endDate={endDate} 
              statusFilter={statusFilter}
              onStartDateChange={setStartDate} 
              onEndDateChange={setEndDate} 
              onStatusFilterChange={setStatusFilter}
            />
          )}
          {activeTab === 'movimento' && <MovimentoPanel />}
        </div>
        
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-gray-500">
          Sistema de Conciliação Mercado Pago &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

// Icon for Upload Tab
function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}

export default App;
