export function parseAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimals] = cleaned.split('.');
  const decimal = decimals.join('').slice(0, 2);
  return decimals.length ? `${whole}.${decimal}` : whole;
}

export function formatAmountInput(value: string) {
  if (!value) return '';
  const parsed = parseAmountInput(value);
  const hasDecimal = parsed.includes('.');
  const [whole = '', decimal = ''] = parsed.split('.');
  const grouped = (whole || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return hasDecimal ? `${grouped}.${decimal}` : grouped;
}

export function amountNumber(value: string | number | null | undefined) {
  const result = typeof value === 'number' ? value : Number(parseAmountInput(String(value ?? '')));
  return Number.isFinite(result) ? result : 0;
}

export function formatAmount(value: string | number | null | undefined) {
  return amountNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
