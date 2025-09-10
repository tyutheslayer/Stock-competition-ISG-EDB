export function LineSkeleton({ className = "" }) {
  return <div className={`skeleton h-4 ${className}`.trim()} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl shadow bg-base-100 p-5">
      <div className="flex items-center justify-between gap-4">
        <LineSkeleton className="w-40" />
        <LineSkeleton className="w-24" />
      </div>
      <div className="mt-4 space-y-2">
        <LineSkeleton className="w-full" />
        <LineSkeleton className="w-5/6" />
        <LineSkeleton className="w-2/3" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><LineSkeleton className="w-20" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><LineSkeleton className="w-24" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
