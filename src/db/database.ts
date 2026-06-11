import Dexie, { type Table } from 'dexie';

export interface Extrato {
  // Composite primary key: reference_id + transaction_type + release_date
  id: string; 
  release_date: string;
  transaction_type: string;
  reference_id: string; // Used for joining
  transaction_net_amount: number;
  partial_balance: number | null;
  // Fields for tracking reconciliation status
  // Conciliado: tem movimento e soma bate
  // Conciliado Divergente: tem movimento mas soma não bate
  // Não Conciliado: sem correspondência no Movimento
  // Pendente: ainda não processado
  status_conciliacao?: 'Conciliado' | 'Conciliado Divergente' | 'Não Conciliado' | 'Pendente';
  total_movimento?: number | null;
}

export interface Movimento {
  // Primary key provided by Mercado Pago
  numero_movimento: string; 
  data_pagamento: string;
  tipo_operacao: string;
  operacao_relacionada: string; // Corresponds to reference_id in Extrato
  valor: number;
}

export class MercadoPagoDB extends Dexie {
  extratos!: Table<Extrato>;
  movimentos!: Table<Movimento>;

  constructor() {
    super('MercadoPagoDB');
    this.version(1).stores({
      // Primary key is 'id'. We also index 'reference_id' for fast lookups/joins
      extratos: 'id, reference_id, status_conciliacao',
      // Primary key is 'numero_movimento'. We index 'operacao_relacionada' for fast joins
      movimentos: 'numero_movimento, operacao_relacionada, tipo_operacao'
    });
  }
}

export const db = new MercadoPagoDB();
