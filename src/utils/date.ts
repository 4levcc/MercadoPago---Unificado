import { parse, isAfter, isBefore, startOfDay } from 'date-fns';

/**
 * Converte uma data no formato DD-MM-YYYY (padrão MP) ou YYYY-MM-DD para um objeto Date
 */
export const parseMpDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // Formato Extrato: DD-MM-YYYY
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 2 && parts[2].length === 4) {
      return parse(dateStr, 'dd-MM-yyyy', new Date());
    }
    // Formato YYYY-MM-DD (inputs de data HTML)
    if (parts[0].length === 4) {
      return parse(dateStr, 'yyyy-MM-dd', new Date());
    }
  }
  // Formato Movimento: ISO '2025-09-01T14:03:05Z'
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

export const isDateInRange = (dateStr: string, startDateStr: string, endDateStr: string): boolean => {
  if (!startDateStr && !endDateStr) return true;
  
  const date = parseMpDate(dateStr);
  if (!date) return false;
  
  const targetDate = startOfDay(date);
  
  if (startDateStr) {
    const start = startOfDay(parseMpDate(startDateStr)!);
    if (isBefore(targetDate, start)) return false;
  }
  
  if (endDateStr) {
    const end = startOfDay(parseMpDate(endDateStr)!);
    if (isAfter(targetDate, end)) return false;
  }
  
  return true;
};
