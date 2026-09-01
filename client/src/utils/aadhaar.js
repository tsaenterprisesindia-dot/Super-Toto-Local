export function formatAadhaar(num) {
  const s = String(num).replace(/[\s\-]/g, '');
  if (s.length !== 12) return s;
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`;
}
