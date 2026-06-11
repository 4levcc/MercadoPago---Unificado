import Dexie, { type Table } from 'dexie';

export interface Extrato {
  id: string; // REFERENCE_ID + TRANSACTION_TYPE + RELEASE_DATE
  releaseDate: string;
  transactionType: string;
  referenceId: string;
  transactionNetAmount: number;
  partialBalance: number;
}

export interface Movimento {
  numeroMovimento: string; // Primary key
  dataPagamento: string;
  tipoOperacao: string;
  operacaoRelacionada: string;
  valor: number;
}

export class BancoConciliacao extends Dexie {
  extratos!: Table<Extrato>;
  movimentos!: Table<Movimento>;

  constructor() {
    super('BancoConciliacaoMP');
    // Declare tables, primary keys and indexes
    this.version(1).stores({
      extratos: 'id, releaseDate, referenceId', // Primary key and indexed props
      movimentos: 'numeroMovimento, dataPagamento, operacaoRelacionada'
    });
  }
}

export const db = new BancoConciliacao();
