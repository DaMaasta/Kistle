export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div
      className={`animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 ${sizeClass}`}
    />
  );
}
