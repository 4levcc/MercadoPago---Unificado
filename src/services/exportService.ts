import * as XLSX from 'xlsx';
import { db, type Movimento } from '../db/database';

// ─────────────────────────────────────────────────────────────────────────────
// Standard movement types for pivot columns
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_TIPOS_MOVIMENTO = [
    'Recebimento',
    'Dinheiro recebido',
    'Tarifa por vender no Mercado Livre',
    'Tarifa de processamento',
    'Tarifa de financiamento',
    'Reembolso do frete',
    'Custos de parcelamento',
    'Custo por absorção da tarifa parcelamento',
    'Devolução por Compra Garantida',
    'Cancelamento de tarifa por vender no Mercado Livre',
    'Cancelamento do custo de processamento',
    'Cancelamento do custo de envio',
    'Cancelamento de custos de parcelamento',
    'Cancelamento de custo por absorção da tarifa parcelamento',
    'Movimentação geral',
    'Pagamento',
    'Transferência via Pix',
    'Devolução de pagamento',
    'Devolução parcial de pagamento',
    'Entrada de dinheiro extra',
    'Custo pela devolução',
    'Devolução de recebimento',
    'Recebimento pelo desconto da sua contraparte',
    'Custo de gestao de venda',
    'Tarifa de venda',
    'Cancelamento de tarifa de venda',
    'Cancelamento de custo de gestao de venda',
    'Custo de envio por cross-docking',
    'Cancelamento de entrada de dinheiro extra',
];

// Tolerance for float comparison (1 centavo)
const TOLERANCE = 0.01;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format date to DD/MM/YYYY
// ─────────────────────────────────────────────────────────────────────────────
function formatDateForExcel(dateStr: string): string {
    if (!dateStr) return '';
    const datePart = dateStr.split(/[T ]/)[0];
    const parts = datePart.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (parts[2].length === 4) {
            return `${parts[0]}/${parts[1]}/${parts[2]}`;
        }
    }
    return dateStr.replace(/-/g, '/');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: robust date sort (handles YYYY-MM-DD, DD-MM-YYYY, ISO timestamps)
// ─────────────────────────────────────────────────────────────────────────────
function getSortableTime(dateStr: string): number {
    if (!dateStr) return 0;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(dateStr).getTime();
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3 && parts[2].length === 4) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`).getTime();
    }
    return new Date(dateStr).getTime() || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subset-Sum Partition Matching
//
// Given N target values (extrato lines) and M movements, try to partition
// the movements into N non-overlapping subsets where each subset sums to its
// respective target. Returns an array of M indices per target, or null if
// no valid partition exists.
//
// Safety limit: skip if M > 20 (performance protection).
// ─────────────────────────────────────────────────────────────────────────────
function partitionMatch(
    targets: number[],
    movements: Movimento[]
): Map<number, Movimento[]> | null {
    if (movements.length > 20) return null; // safety limit
    if (targets.length === 0 || movements.length === 0) return null;

    const M = movements.length;
    const N = targets.length;
    const used = new Array(M).fill(false);
    const result: Movimento[][] = Array.from({ length: N }, () => []);

    // Round to cents to avoid float drift
    const round = (v: number) => Math.round(v * 100);
    const roundedTargets = targets.map(round);
    const roundedValues = movements.map(m => round(m.valor));

    function backtrack(targetIdx: number): boolean {
        if (targetIdx === N) {
            // All targets satisfied — check all movements used
            return used.every(u => u);
        }

        const target = roundedTargets[targetIdx];

        // Try every subset of unused movements for this target
        // Use bitmask iteration for subsets
        const unusedIdx: number[] = [];
        for (let i = 0; i < M; i++) {
            if (!used[i]) unusedIdx.push(i);
        }

        const unusedCount = unusedIdx.length;
        const subsetCount = 1 << unusedCount;

        for (let mask = 1; mask < subsetCount; mask++) {
            let sum = 0;
            const chosen: number[] = [];
            for (let bit = 0; bit < unusedCount; bit++) {
                if (mask & (1 << bit)) {
                    sum += roundedValues[unusedIdx[bit]];
                    chosen.push(unusedIdx[bit]);
                }
            }
            if (sum === target) {
                // Mark chosen as used
                for (const idx of chosen) used[idx] = true;
                result[targetIdx] = chosen.map(idx => movements[idx]);

                if (backtrack(targetIdx + 1)) return true;

                // Undo
                for (const idx of chosen) used[idx] = false;
                result[targetIdx] = [];
            }
        }
        return false;
    }

    if (backtrack(0)) {
        const assignment = new Map<number, Movimento[]>();
        for (let i = 0; i < N; i++) {
            assignment.set(i, result[i]);
        }
        return assignment;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Unified Matcher: Handles zero-sum groups and partial matches
// ─────────────────────────────────────────────────────────────────────────────
type MovAssignment = { movs: Movimento[], isZeroSum: boolean };

function findBestReconciliation(
    targets: number[],
    movements: Movimento[]
): Map<number, MovAssignment> | null {
    const N = targets.length;
    // Safety limit to avoid huge subsets iteration
    if (N > 15 || movements.length > 20) return null;

    const round = (v: number) => Math.round(v * 100);
    const roundedTargets = targets.map(round);
    const roundedValues = movements.map(m => round(m.valor));
    const movSum = roundedValues.reduce((a, b) => a + b, 0);

    const targetSubsetCount = 1 << N;

    // Step 1: Full match with zero-sum support
    for (let mask = 0; mask < targetSubsetCount; mask++) {
        let sumZ = 0;
        const remainingIndices: number[] = [];
        const zeroIndices: number[] = [];

        for (let i = 0; i < N; i++) {
            if (mask & (1 << i)) {
                sumZ += roundedTargets[i];
                zeroIndices.push(i);
            } else {
                remainingIndices.push(i);
            }
        }

        if (sumZ === 0) {
            const rSum = remainingIndices.reduce((s, i) => s + roundedTargets[i], 0);
            if (rSum === movSum) {
                const remainingTargets = remainingIndices.map(i => targets[i]);
                const subMatch = partitionMatch(remainingTargets, movements);

                if (subMatch) {
                    const assignment = new Map<number, MovAssignment>();
                    for (const idx of zeroIndices) {
                        assignment.set(idx, { movs: [], isZeroSum: true });
                    }
                    for (let i = 0; i < remainingIndices.length; i++) {
                        assignment.set(remainingIndices[i], { movs: subMatch.get(i) || [], isZeroSum: false });
                    }
                    return assignment;
                }
            }
        }
    }

    // Step 2: Partial match (find largest subset S that consumes ALL movements)
    let bestPartialMatch: Map<number, MovAssignment> | null = null;
    let maxSSize = -1;

    for (let mask = 1; mask < targetSubsetCount; mask++) {
        let sumS = 0;
        const sIndices: number[] = [];
        const uIndices: number[] = [];

        for (let i = 0; i < N; i++) {
            if (mask & (1 << i)) {
                sumS += roundedTargets[i];
                sIndices.push(i);
            } else {
                uIndices.push(i);
            }
        }

        if (sumS === movSum && sIndices.length > maxSSize) {
            const sTargets = sIndices.map(i => targets[i]);
            const subMatch = partitionMatch(sTargets, movements);

            if (subMatch) {
                const assignment = new Map<number, MovAssignment>();
                for (let i = 0; i < sIndices.length; i++) {
                    assignment.set(sIndices[i], { movs: subMatch.get(i) || [], isZeroSum: false });
                }
                for (const idx of uIndices) {
                    assignment.set(idx, { movs: [], isZeroSum: false }); // Unmatched!
                }
                bestPartialMatch = assignment;
                maxSSize = sIndices.length;
            }
        }
    }

    return bestPartialMatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core reconciliation: processes each extrato line individually.
// For reference IDs with multiple extrato lines, attempts subset-sum partition.
// ─────────────────────────────────────────────────────────────────────────────
export async function processReconciliation() {
    const extratos = await db.extratos.toArray();
    const movimentos = await db.movimentos.toArray();

    // Build movement index by operacao_relacionada
    const movMap = new Map<string, Movimento[]>();
    const allTipos = new Set<string>(DEFAULT_TIPOS_MOVIMENTO);

    for (const mov of movimentos) {
        if (!mov.operacao_relacionada) continue;
        const list = movMap.get(mov.operacao_relacionada) || [];
        list.push(mov);
        movMap.set(mov.operacao_relacionada, list);
        allTipos.add(mov.tipo_operacao);
    }

    const dinamicTipos = Array.from(allTipos);

    // ── Step 1: group extrato lines by reference_id (preserving order) ──────
    // Key: reference_id, Value: array of extrato records (in DB order)
    const extratosByRef = new Map<string, typeof extratos>();
    for (const ext of extratos) {
        const list = extratosByRef.get(ext.reference_id) || [];
        list.push(ext);
        extratosByRef.set(ext.reference_id, list);
    }

    // ── Step 2: compute movement assignments per extrato line ────────────────
    // assignment: extratoId → MovAssignment
    const movAssignment = new Map<string, MovAssignment>();

    for (const [refId, extGroup] of extratosByRef) {
        const movements = movMap.get(refId) || [];

        if (movements.length === 0) {
            // No movements at all for this reference_id
            for (const ext of extGroup) {
                movAssignment.set(ext.id, { movs: [], isZeroSum: false });
            }
            continue;
        }

        if (extGroup.length === 1) {
            // Simple case: single extrato line, all movements belong to it
            movAssignment.set(extGroup[0].id, { movs: movements, isZeroSum: false });
            continue;
        }

        // Multiple extrato lines → try finding best unified reconciliation
        const targets = extGroup.map(e => e.transaction_net_amount);
        const partition = findBestReconciliation(targets, movements);

        if (partition) {
            // Partition found: apply assignments
            for (let i = 0; i < extGroup.length; i++) {
                movAssignment.set(extGroup[i].id, partition.get(i)!);
            }
        } else {
            // No partition found: fall back — all movements assigned to all lines
            // (they will be marked Conciliado Divergente)
            for (const ext of extGroup) {
                movAssignment.set(ext.id, { movs: movements, isZeroSum: false });
            }
        }
    }

    // ── Step 3: compute status and summaries for each extrato line ───────────
    const processedList: any[] = [];
    const summaryMap = new Map<string, {
        qty: number; totalExtrato: number; totalMovimento: number;
        conciliados: number; divergentes: number; naoConciliados: number;
    }>();

    for (const ext of extratos) {
        const assign = movAssignment.get(ext.id)!;
        const relatedMovs = assign.movs;
        const isMapped = relatedMovs.length > 0;

        let totalMovimento = 0;
        const pivotData: Record<string, number> = {};

        if (isMapped) {
            for (const m of relatedMovs) {
                totalMovimento += m.valor;
                pivotData[m.tipo_operacao] = (pivotData[m.tipo_operacao] || 0) + m.valor;
            }
        }

        // Determine status dynamically based on rules
        let status: 'Conciliado' | 'Conciliado Divergente' | 'Não Conciliado' | 'Pendente';
        
        if (assign.isZeroSum) {
            // Part of a self-canceling group within the extrato. Internally resolved.
            status = 'Conciliado';
        } else if (!isMapped) {
            // Unmatched leftover from partial match or simply missing in movements.
            status = 'Não Conciliado';
        } else if (Math.abs(ext.transaction_net_amount - totalMovimento) > TOLERANCE) {
            status = 'Conciliado Divergente';
        } else {
            status = 'Conciliado';
        }

        // Persist status to DB
        if (ext.status_conciliacao !== status || ext.total_movimento !== (isMapped ? totalMovimento : null)) {
            await db.extratos.update(ext.id, {
                status_conciliacao: status,
                total_movimento: isMapped ? totalMovimento : null
            });
        }

        processedList.push({
            ...ext,
            status_conciliacao: status,
            total_movimento: isMapped ? totalMovimento : null,
            relatedMovs,
            pivotData,
            diferenca: isMapped ? (ext.transaction_net_amount - totalMovimento) : null,
        });

        // Summary by transaction_type
        const summary = summaryMap.get(ext.transaction_type) || {
            qty: 0, totalExtrato: 0, totalMovimento: 0,
            conciliados: 0, divergentes: 0, naoConciliados: 0
        };
        summary.qty++;
        summary.totalExtrato += ext.transaction_net_amount;
        if (isMapped) summary.totalMovimento += totalMovimento;
        if (status === 'Conciliado') summary.conciliados++;
        else if (status === 'Conciliado Divergente') summary.divergentes++;
        else summary.naoConciliados++;
        summaryMap.set(ext.transaction_type, summary);
    }

    // Sort by release_date ascending
    processedList.sort((a, b) => getSortableTime(a.release_date) - getSortableTime(b.release_date));

    const summaryList = Array.from(summaryMap.entries()).map(([tipo, data]) => ({
        'Tipo de Lançamento (Extrato)': tipo,
        'Qtd Lançamentos': data.qty,
        'Valor Total Extrato': data.totalExtrato,
        'Valor Total Movimento': data.totalMovimento,
        'Conciliados': data.conciliados,
        'Conciliados Divergentes': data.divergentes,
        'Não Conciliados': data.naoConciliados,
    }));

    return { processedList, summaryList, tiposMovimento: dinamicTipos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function exportToXlsx(format: 'pivotado' | 'auditoria' | 'cronologico') {
    const data = await processReconciliation();
    const wb = XLSX.utils.book_new();

    let mainSheetData: any[] = [];

    if (format === 'pivotado') {
        // ─────────────────────────────────────────────────────────────────────
        // PIVOTADO (Horizontal) — 558 linhas, espelho 1:1 do extrato
        // ─────────────────────────────────────────────────────────────────────
        const headers = [
            'Data Lançamento', 'Tipo (Extrato)', 'Reference ID',
            'Valor Líquido (Extrato)', 'Saldo Parcial',
            'Status Conciliação', 'Total Movimento',
            ...data.tiposMovimento
        ];
        mainSheetData.push(headers);

        for (const row of data.processedList) {
            const arr: any[] = [
                formatDateForExcel(row.release_date),
                row.transaction_type,
                row.reference_id,
                row.transaction_net_amount,
                row.partial_balance ?? '',
                row.status_conciliacao,
                row.total_movimento ?? '',
            ];
            for (const tipo of data.tiposMovimento) {
                arr.push(row.pivotData[tipo] !== undefined ? row.pivotData[tipo] : '');
            }
            mainSheetData.push(arr);
        }

    } else if (format === 'auditoria') {
        // ─────────────────────────────────────────────────────────────────────
        // AUDITORIA (Vertical em blocos)
        // Linha extrato → movimentos pareados → total
        // ─────────────────────────────────────────────────────────────────────
        const headers = [
            'Data Lançamento', 'Tipo de Operação',
            'Reference ID / Operação Relacionada',
            'Valor', 'Saldo Parcial / Número Mov.', 'Status Conciliação'
        ];
        mainSheetData.push(headers);

        for (const row of data.processedList) {
            // Linha do extrato
            mainSheetData.push([
                formatDateForExcel(row.release_date),
                row.transaction_type,
                row.reference_id,
                row.transaction_net_amount,
                row.partial_balance ?? '',
                row.status_conciliacao,
            ]);

            if (row.relatedMovs && row.relatedMovs.length > 0) {
                for (const m of row.relatedMovs) {
                    mainSheetData.push([
                        formatDateForExcel(m.data_pagamento),
                        `  ↳ ${m.tipo_operacao}`,
                        m.operacao_relacionada,
                        m.valor,
                        m.numero_movimento,
                        '',
                    ]);
                }
                // Total line
                mainSheetData.push([
                    '',
                    '  ↳ TOTAL CALCULADO',
                    row.reference_id,
                    row.total_movimento,
                    '',
                    row.status_conciliacao === 'Conciliado' ? '✓ Bate' : '⚠ Diverge',
                ]);
            }
        }

    } else if (format === 'cronologico') {
        // ─────────────────────────────────────────────────────────────────────
        // CRONOLÓGICO (Vertical plano — soma deve = R$ 7.913,00)
        // Conciliado:           substitui linha do extrato pelos movimentos pareados
        // Conciliado Divergente: movimentos pareados + linha de Ajuste de Saldo
        // Não Conciliado:       mantém linha do extrato original
        // ─────────────────────────────────────────────────────────────────────
        const headers = [
            'Data Lançamento', 'Tipo de Operação',
            'Operação Relacionada', 'Valor', 'Número Mov.', 'Status'
        ];
        mainSheetData.push(headers);

        for (const row of data.processedList) {
            if (row.status_conciliacao === 'Não Conciliado') {
                // Mantém linha do extrato
                mainSheetData.push([
                    formatDateForExcel(row.release_date),
                    row.transaction_type,
                    row.reference_id,
                    row.transaction_net_amount,
                    '',
                    'Não Conciliado',
                ]);
            } else {
                // Conciliado ou Conciliado Divergente: imprime movimentos pareados
                for (const m of row.relatedMovs) {
                    mainSheetData.push([
                        formatDateForExcel(row.release_date), // herda data do extrato
                        m.tipo_operacao,
                        m.operacao_relacionada,
                        m.valor,
                        m.numero_movimento,
                        '',
                    ]);
                }
                // Se divergente, adiciona linha de ajuste para manter a soma
                if (row.status_conciliacao === 'Conciliado Divergente' && row.diferenca !== null) {
                    mainSheetData.push([
                        formatDateForExcel(row.release_date),
                        row.diferenca > 0 ? 'Ajuste de Saldo (+)' : 'Ajuste de Saldo (-)',
                        row.reference_id,
                        row.diferenca,
                        '',
                        'Ajuste',
                    ]);
                }
            }
        }
    }

    const wsMain = XLSX.utils.aoa_to_sheet(mainSheetData);
    XLSX.utils.book_append_sheet(wb, wsMain, 'Conciliação Completa');

    // Resumo por Tipo
    const wsSummary = XLSX.utils.json_to_sheet(data.summaryList);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por Tipo');

    // Não Conciliados
    const unmappedData = data.processedList
        .filter(r => r.status_conciliacao === 'Não Conciliado')
        .map(r => ({
            'Data Lançamento': formatDateForExcel(r.release_date),
            'Tipo Extrato': r.transaction_type,
            'Reference ID': r.reference_id,
            'Valor Líquido': r.transaction_net_amount,
            'Saldo Parcial': r.partial_balance ?? '',
        }));
    const wsUnmapped = XLSX.utils.json_to_sheet(
        unmappedData.length ? unmappedData : [{ 'Info': 'Nenhum lançamento sem correspondência' }]
    );
    XLSX.utils.book_append_sheet(wb, wsUnmapped, 'Não Conciliados');

    const monthYears = new Set<string>();
    data.processedList.forEach(r => {
        const dateStr = r.release_date;
        if (!dateStr) return;
        let month, year;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const parts = dateStr.split(/[-/]/);
            year = parts[0];
            month = parts[1];
        } else {
            const parts = dateStr.split(/[-/]/);
            if (parts.length === 3 && parts[2].length === 4) {
                month = parts[1];
                year = parts[2];
            }
        }
        if (month && year) {
            monthYears.add(`${month}${year}`);
        }
    });
    
    const monthYearSuffix = monthYears.size > 0 ? ` - ${Array.from(monthYears).sort().join(' ')}` : '';

    const fileNameMap = {
        'pivotado': `Extrato Pivotado - MP${monthYearSuffix}.xlsx`,
        'auditoria': `Extrato Auditoria - MP${monthYearSuffix}.xlsx`,
        'cronologico': `Extrato Analítico - MP${monthYearSuffix}.xlsx`
    };
    const fileName = fileNameMap[format] || `Conciliacao_MercadoPago_${format}${monthYearSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
