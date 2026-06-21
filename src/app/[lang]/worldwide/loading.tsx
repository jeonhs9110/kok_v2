export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
      <div className="border-b border-neutral-200 pb-8 mb-12">
        <div className="h-3 w-24 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mb-3" />
        <div className="h-12 w-1/2 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="border border-neutral-200 rounded-xl p-5 space-y-3">
            <div className="h-5 w-32 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-full bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-3/4 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
