import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { FileSpreadsheet, ListOrdered, CheckSquare, AlertTriangle, XCircle } from 'lucide-react';

export const DashboardStats: React.FC = () => {
  const stats = useLiveQuery(async () => {
    const totalExtratos = await db.extratos.count();
    const totalMovimentos = await db.movimentos.count();
    const totalConciliados = await db.extratos.where('status_conciliacao').equals('Conciliado').count();
    const totalDivergentes = await db.extratos.where('status_conciliacao').equals('Conciliado Divergente').count();
    const totalNaoConciliados = await db.extratos.where('status_conciliacao').equals('Não Conciliado').count();

    return { totalExtratos, totalMovimentos, totalConciliados, totalDivergentes, totalNaoConciliados };
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Linhas Extrato */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">Linhas Extrato CB</p>
          <h4 className="text-xl font-bold text-gray-900">{stats.totalExtratos}</h4>
        </div>
      </div>

      {/* Linhas Movimento */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
          <ListOrdered className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">Linhas Movimento</p>
          <h4 className="text-xl font-bold text-gray-900">{stats.totalMovimentos}</h4>
        </div>
      </div>

      {/* Conciliados */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
          <CheckSquare className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">Conciliados</p>
          <h4 className="text-xl font-bold text-emerald-700">{stats.totalConciliados}</h4>
        </div>
      </div>

      {/* Conciliados Divergentes */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">Divergentes</p>
          <h4 className="text-xl font-bold text-orange-600">{stats.totalDivergentes}</h4>
        </div>
      </div>

      {/* Não Conciliados */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="p-2.5 bg-red-50 text-red-600 rounded-lg shrink-0">
          <XCircle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">Não Conciliados</p>
          <h4 className="text-xl font-bold text-red-600">{stats.totalNaoConciliados}</h4>
        </div>
      </div>
    </div>
  );
};
