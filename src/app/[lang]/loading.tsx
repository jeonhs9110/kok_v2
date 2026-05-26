export default function Loading() {
  return (
    <>
      <div className="w-full h-[440px] sm:h-[600px] bg-neutral-100 animate-pulse motion-reduce:animate-none" />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {[0, 1].map(i => (
            <div key={i} className="aspect-square bg-neutral-100 animate-pulse motion-reduce:animate-none rounded-xl" />
          ))}
        </div>
      </div>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24">
        <div className="flex flex-col items-center mb-12">
          <div className="h-7 w-32 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-16 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mt-3" />
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-12 lg:gap-x-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.5rem)]">
              <div className="aspect-[5/6] bg-neutral-100 animate-pulse motion-reduce:animate-none rounded-[16px] mb-4" />
              <div className="space-y-2 px-1">
                <div className="h-3 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none w-3/4" />
                <div className="h-3 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none w-1/2" />
                <div className="h-4 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
