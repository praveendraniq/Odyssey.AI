export const formatDisplayPhone = (value?: string) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('1')) return value;
  return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
};
