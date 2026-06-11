import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { isDateInRange } from '../utils/date';

interface ExportButtonProps {
  startDate: string;
  endDate: string;
  statusFilter: 'all' | 'analitico' | 'pendente';
}

// Lista fixa de tipos de operação conforme spec do AGENTE_Conciliacao_MercadoPago.md
const TIPOS_MOVIMENTO = [
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

// Cores conforme spec
const COLORS = {
  // Grupo A - Extrato (cabeçalho azul escuro, dados azul claro)
  headerA: '1F4E79',
  dataA: 'DAE8FC',
  // Grupo B - Controle (cabeçalho laranja, dados amarelo claro)
  headerB: 'BF5700',
  dataB: 'FFF2CC',
  // Grupo C - Movimento (cabeçalho verde escuro, dados verde claro)
  headerC: '375623',
  dataC: 'D5E8D4',
  // Sem correspondência
  semCorrespondencia: 'FCE4D6',
  // Bordas
  border: 'B0B0B0',
  // Cabeçalhos texto branco
  headerText: 'FFFFFF',
};

function applyBorder(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  }
}

export function ExportButton({ startDate, endDate, statusFilter }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // ── 1. Carregar dados ──────────────────────────────────────────────────
      const allExtratos = await db.extratos.toArray();
      const extratos = allExtratos.filter(ext =>
        isDateInRange(ext.releaseDate, startDate, endDate)
      );

      // Ordenar por data (mais antigas primeiro)
      extratos.sort((a, b) => {
        const parseDate = (d: string) => {
          if (d.includes('-')) {
            const parts = d.split('-');
            if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return d;
        };
        return parseDate(a.releaseDate).localeCompare(parseDate(b.releaseDate));
      });

      // Detectar tipos novos não mapeados na lista fixa
      const allMovimentos = await db.movimentos.toArray();
      const tiposPresentes = new Set(allMovimentos.map(m => m.tipoOperacao));
      const tiposFinais = [...TIPOS_MOVIMENTO];
      for (const tipo of tiposPresentes) {
        if (!tiposFinais.includes(tipo)) {
          tiposFinais.push(tipo);
        }
      }

      // ── 2. Processar cada extrato (pivotamento) ───────────────────────────
      interface LinhaRelatorio {
        dataLancamento: string;
        tipoExtrato: string;
        referenceId: string;
        valorLiquidoExtrato: string;  // formatado BR
        saldoParcial: string;         // formatado BR
        statusConciliacao: string;
        totalMovimento: number | null;
        tiposPivotados: Record<string, number | null>;
        isConciliado: boolean;
      }

      const formatBR = (v: number | null | undefined): string => {
        if (v == null) return '';
        return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const linhas: LinhaRelatorio[] = [];

      for (const extrato of extratos) {
        const movimentos = await db.movimentos
          .where('operacaoRelacionada')
          .equals(extrato.referenceId)
          .toArray();

        // Filtro por status
        const isAnalitico = movimentos.length > 0;
        if (statusFilter === 'analitico' && !isAnalitico) continue;
        if (statusFilter === 'pendente' && isAnalitico) continue;

        // Pivotar: groupBy tipoOperacao → somar valores
        const tiposPivotados: Record<string, number | null> = {};
        for (const tipo of tiposFinais) {
          tiposPivotados[tipo] = null;
        }

        let totalMovimento: number | null = null;

        if (movimentos.length > 0) {
          totalMovimento = 0;
          for (const mov of movimentos) {
            const tipo = mov.tipoOperacao;
            if (!tiposFinais.includes(tipo)) tiposFinais.push(tipo);
            tiposPivotados[tipo] = (tiposPivotados[tipo] ?? 0) + mov.valor;
            totalMovimento += mov.valor;
          }
          // Arredondar total (evitar floating point noise)
          totalMovimento = Math.round(totalMovimento * 100) / 100;
        }

        linhas.push({
          dataLancamento: extrato.releaseDate,
          tipoExtrato: extrato.transactionType,
          referenceId: extrato.referenceId,
          valorLiquidoExtrato: formatBR(extrato.transactionNetAmount),
          saldoParcial: formatBR(extrato.partialBalance),
          statusConciliacao: movimentos.length > 0 ? 'Conciliado' : 'Sem correspondência no Movimento',
          totalMovimento,
          tiposPivotados,
          isConciliado: movimentos.length > 0,
        });
      }

      // ── 3. Gerar Excel com ExcelJS ─────────────────────────────────────────
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema Conciliação MP';
      workbook.created = new Date();

      const colCount = 7 + tiposFinais.length; // 5 extrato + 2 controle + N tipos

      // ════════════════════════════════════════════════════════════════════
      // ABA 1 — Conciliação Completa
      // ════════════════════════════════════════════════════════════════════
      const ws1 = workbook.addWorksheet('Conciliação Completa');

      // Linha 1 — vazia (reservada para agrupamento visual)
      ws1.addRow([]);

      // Linha 2 — Cabeçalho
      const cabecalhos = [
        'Data Lançamento',
        'Tipo (Extrato)',
        'Reference ID',
        'Valor Líquido (Extrato)',
        'Saldo Parcial',
        'Status Conciliação',
        'Total Movimento',
        ...tiposFinais,
      ];
      const headerRow = ws1.addRow(cabecalhos);
      headerRow.height = 40;

      // Estilo do cabeçalho por grupo
      cabecalhos.forEach((_, idx) => {
        const cell = headerRow.getCell(idx + 1);
        let bgColor = COLORS.headerA;
        if (idx === 5 || idx === 6) bgColor = COLORS.headerB;
        if (idx >= 7) bgColor = COLORS.headerC;

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.headerText } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } },
        };
      });

      // Larguras de coluna
      ws1.getColumn(1).width = 14;  // DATA
      ws1.getColumn(2).width = 40;  // TIPO_EXTRATO
      ws1.getColumn(3).width = 18;  // REFERENCE_ID
      ws1.getColumn(4).width = 18;  // VALOR_LIQUIDO
      ws1.getColumn(5).width = 14;  // SALDO_PARCIAL
      ws1.getColumn(6).width = 30;  // STATUS
      ws1.getColumn(7).width = 16;  // TOTAL_MOVIMENTO
      for (let c = 8; c <= colCount; c++) {
        ws1.getColumn(c).width = 22;
      }

      // Congelar painéis em A3 (linha 3 = primeira linha de dados)
      ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

      // Linhas de dados
      for (const linha of linhas) {
        const rowValues = [
          linha.dataLancamento,
          linha.tipoExtrato,
          linha.referenceId,
          linha.valorLiquidoExtrato,
          linha.saldoParcial,
          linha.statusConciliacao,
          linha.totalMovimento,
          ...tiposFinais.map(tipo => linha.tiposPivotados[tipo] ?? null),
        ];
        const dataRow = ws1.addRow(rowValues);
        dataRow.height = 16;

        // Cor de fundo por grupo e por status
        rowValues.forEach((_, idx) => {
          const cell = dataRow.getCell(idx + 1);
          let bgColor = linha.isConciliado ? COLORS.dataA : COLORS.semCorrespondencia;
          if (linha.isConciliado) {
            if (idx === 5 || idx === 6) bgColor = COLORS.dataB;
            if (idx >= 7) bgColor = COLORS.dataC;
          }

          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };

          // Formato numérico para valores
          if (idx >= 6 && typeof rowValues[idx] === 'number') {
            cell.numFmt = '#,##0.00';
          }
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // ABA 2 — Resumo por Tipo
      // ════════════════════════════════════════════════════════════════════
      const ws2 = workbook.addWorksheet('Resumo por Tipo');

      const resumoCabecalhos = [
        'Tipo de Lançamento (Extrato)',
        'Qtd Lançamentos',
        'Valor Total Extrato',
        'Valor Total Movimento',
        'Conciliados',
        'Sem Correspondência',
      ];

      const resumoHeaderRow = ws2.addRow(resumoCabecalhos);
      resumoHeaderRow.height = 30;
      resumoCabecalhos.forEach((_, idx) => {
        const cell = resumoHeaderRow.getCell(idx + 1);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerA } };
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.headerText } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } },
        };
      });
      ws2.getColumn(1).width = 55;
      ws2.getColumn(2).width = 16;
      ws2.getColumn(3).width = 20;
      ws2.getColumn(4).width = 20;
      ws2.getColumn(5).width = 14;
      ws2.getColumn(6).width = 20;

      // Agregar por tipo de extrato
      const resumoMap = new Map<string, {
        qtd: number;
        valorExtrato: number;
        valorMovimento: number;
        conciliados: number;
        semCorrespondencia: number;
      }>();

      for (const linha of linhas) {
        const key = linha.tipoExtrato;
        if (!resumoMap.has(key)) {
          resumoMap.set(key, { qtd: 0, valorExtrato: 0, valorMovimento: 0, conciliados: 0, semCorrespondencia: 0 });
        }
        const entry = resumoMap.get(key)!;
        entry.qtd += 1;
        entry.valorExtrato += linha.isConciliado
          ? (typeof linha.valorLiquidoExtrato === 'string'
            ? parseFloat(linha.valorLiquidoExtrato.replace(/\./g, '').replace(',', '.')) || 0
            : 0)
          : (typeof linha.valorLiquidoExtrato === 'string'
            ? parseFloat(linha.valorLiquidoExtrato.replace(/\./g, '').replace(',', '.')) || 0
            : 0);
        entry.valorMovimento += linha.totalMovimento ?? 0;
        if (linha.isConciliado) entry.conciliados += 1;
        else entry.semCorrespondencia += 1;
      }

      // Ordenar por nome do tipo
      const resumoEntries = [...resumoMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

      for (const [tipo, dados] of resumoEntries) {
        const resumoRow = ws2.addRow([
          tipo,
          dados.qtd,
          Math.round(dados.valorExtrato * 100) / 100,
          Math.round(dados.valorMovimento * 100) / 100,
          dados.conciliados,
          dados.semCorrespondencia,
        ]);

        resumoRow.height = 16;
        for (let c = 1; c <= 6; c++) {
          const cell = resumoRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
          if (c === 3 || c === 4) cell.numFmt = '#,##0.00';
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // ABA 3 — Sem Correspondência
      // ════════════════════════════════════════════════════════════════════
      const ws3 = workbook.addWorksheet('Sem Correspondência');

      const semCorrCabecalhos = [
        'Data Lançamento',
        'Tipo Extrato',
        'Reference ID',
        'Valor Líquido',
        'Saldo Parcial',
      ];

      const semCorrHeaderRow = ws3.addRow(semCorrCabecalhos);
      semCorrHeaderRow.height = 30;
      semCorrCabecalhos.forEach((_, idx) => {
        const cell = semCorrHeaderRow.getCell(idx + 1);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerB } };
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.headerText } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } },
        };
      });
      ws3.getColumn(1).width = 16;
      ws3.getColumn(2).width = 45;
      ws3.getColumn(3).width = 18;
      ws3.getColumn(4).width = 16;
      ws3.getColumn(5).width = 16;

      const semCorrespondencia = linhas.filter(l => !l.isConciliado);
      for (const linha of semCorrespondencia) {
        const semCorrRow = ws3.addRow([
          linha.dataLancamento,
          linha.tipoExtrato,
          linha.referenceId,
          linha.valorLiquidoExtrato,
          linha.saldoParcial,
        ]);
        semCorrRow.height = 16;
        for (let c = 1; c <= 5; c++) {
          const cell = semCorrRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.semCorrespondencia } };
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
        }
      }

      // ── 4. Gerar e fazer download ─────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dataString = new Date().toISOString().split('T')[0];
      link.download = `ConciliacaoAnalitica_MercadoPago_${dataString}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Houve um erro ao gerar o relatório. Verifique o console para detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Download className="w-5 h-5" />
      )}
      {isExporting ? 'Gerando...' : 'Exportar Extrato Analítico'}
    </button>
  );
}
