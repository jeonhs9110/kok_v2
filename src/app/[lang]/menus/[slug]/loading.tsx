export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
      <div className="h-3 w-32 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mb-10" />
      <div className="border-b border-neutral-200 pb-8 mb-12">
        <div className="h-3 w-20 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mb-3" />
        <div className="h-12 w-1/2 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 w-full bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
