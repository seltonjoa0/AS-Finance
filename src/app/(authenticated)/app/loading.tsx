export default function AppLoading() {
  return (
    <div className="animate-pulse" aria-label="Carregando conteúdo" role="status">
      <div className="h-4 w-24 rounded-full bg-line" />
      <div className="mt-3 h-9 w-64 rounded-xl bg-line" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-full bg-line" />
      <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-[18px] border border-line bg-white" />
        ))}
      </div>
      <div className="mt-5 h-80 rounded-[20px] border border-line bg-white" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
