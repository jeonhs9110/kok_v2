export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square bg-neutral-100 animate-pulse motion-reduce:animate-none rounded-xl" />
        <div className="space-y-4">
          <div className="h-3 w-20 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-8 w-3/4 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-full bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-5/6 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-10 w-32 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none mt-6" />
          <div className="h-12 w-full bg-neutral-200 rounded animate-pulse motion-reduce:animate-none mt-8" />
        </div>
      </div>
    </div>
  );
}
