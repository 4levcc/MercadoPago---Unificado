import * as XLSX from 'xlsx';
import { db, type Extrato, type Movimento } from '../db/database';

// Utils
function excelDateToJSDate(serial: number): string {
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  // Extrato dates are usually DD-MM-YYYY or similar. For consistency, let's store as YYYY-MM-DD
  return date_info.toISOString().split('T')[0];
}

function parseBrNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  try {
    let strVal = String(val).trim();
    // Se contém vírgula, assumimos padrão BR (ex: 1.234,56 ou -0,1)
    if (strVal.includes(',')) {
      strVal = strVal.replace(/\./g, '').replace(',', '.');
    }
    // Caso contrário, assumimos que já é um float válido (ex: -0.1)
    
    const parsed = parseFloat(strVal);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

export async function importExtrato(file: File): Promise<{ success: boolean; rowsProcessed: number; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Extrato has 3 lines of header. We skip 3 rows (range: 3 indicates start at 4th row)
        // However, SheetJS sheet_to_json doesn't perfectly skip if headers are weird.
        // Let's get it as an array of arrays first.
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        // Remove first 3 rows
        const dataRows = rawData.slice(3);

        // Each extrato line is stored individually.
        // Primary key uses row index as suffix to guarantee NO line is ever lost,
        // even when the same refId + type + date appear on multiple rows (real duplicates).
        const extratos: Extrato[] = [];
        let rowIndex = 0;

        for (const row of dataRows) {
          // Columns based on Instructions:
          // 0: RELEASE_DATE
          // 1: TRANSACTION_TYPE
          // 2: REFERENCE_ID
          // 3: TRANSACTION_NET_AMOUNT
          // 4: PARTIAL_BALANCE
          
          if (!row || row.length === 0 || !row[0]) continue;
          if (String(row[0]) === 'RELEASE_DATE') continue; // Ghost header

          const release_date = typeof row[0] === 'number' ? excelDateToJSDate(row[0]) : String(row[0]).trim();
          const transaction_type = String(row[1] || '').trim();
          const reference_id = String(row[2] || '').trim();
          const transaction_net_amount = parseBrNumber(row[3]);
          const partial_balance = row[4] ? parseBrNumber(row[4]) : null;

          // Required fields validation
          if (!reference_id || !release_date) continue;

          // rowIndex suffix guarantees uniqueness even when refId+type+date repeat
          const id = `${reference_id}_${transaction_type}_${release_date}_${rowIndex++}`;

          extratos.push({
            id,
            release_date,
            transaction_type,
            reference_id,
            transaction_net_amount,
            partial_balance,
            status_conciliacao: 'Pendente'
          });
        }

        if (extratos.length > 0) {
          // Bulk put will insert or replace existing entries with the same ID
          await db.extratos.bulkPut(extratos);
        }

        resolve({ success: true, rowsProcessed: extratos.length, message: `Extrato importado com sucesso. ${extratos.length} linhas processadas.` });
      } catch (error: any) {
        resolve({ success: false, rowsProcessed: 0, message: `Erro ao importar extrato: ${error.message}` });
      }
    };
    reader.onerror = () => resolve({ success: false, rowsProcessed: 0, message: 'Erro na leitura do arquivo' });
    reader.readAsArrayBuffer(file);
  });
}

export async function importMovimento(file: File): Promise<{ success: boolean; rowsProcessed: number; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        // Movimento data starts at line 2 (line 1 is header)
        const dataRows = rawData.slice(1);

        const movimentos: Movimento[] = [];

        for (const row of dataRows) {
          // Columns based on Instructions:
          // 0: Data de pagamento
          // 1: Tipo de operação
          // 2: Número do movimento
          // 3: Operação relacionada
          // 4: Valor
          
          if (!row || row.length < 5 || !row[2]) continue;

          const data_pagamento = typeof row[0] === 'number' ? excelDateToJSDate(row[0]) : String(row[0]).trim();
          const tipo_operacao = String(row[1] || '').trim();
          const numero_movimento = String(row[2]).trim();
          const operacao_relacionada = String(row[3] || '').trim();
          const valor = typeof row[4] === 'number' ? row[4] : parseBrNumber(row[4]);

          if (!numero_movimento) continue;

          movimentos.push({
            numero_movimento,
            data_pagamento,
            tipo_operacao,
            operacao_relacionada,
            valor
          });
        }

        if (movimentos.length > 0) {
          await db.movimentos.bulkPut(movimentos);
        }

        resolve({ success: true, rowsProcessed: movimentos.length, message: `Movimento importado com sucesso. ${movimentos.length} linhas processadas.` });
      } catch (error: any) {
        resolve({ success: false, rowsProcessed: 0, message: `Erro ao importar movimento: ${error.message}` });
      }
    };
    reader.onerror = () => resolve({ success: false, rowsProcessed: 0, message: 'Erro na leitura do arquivo' });
    reader.readAsArrayBuffer(file);
  });
}
