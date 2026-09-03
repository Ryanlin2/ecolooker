// src/app/dashboards/us-industry-gdp/loading.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <article className="space-y-12">
      <header className="mb-8 border-b pb-6">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="mt-3 h-9 w-3/4 max-w-xl" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />
        <Skeleton className="mt-3 h-3 w-40" />
      </header>

      <Skeleton className="h-12 w-full" />

      <section className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardContent className="pt-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
          <Skeleton className="mt-6 h-80 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-72 w-full" />
        </CardContent>
      </Card>
    </article>
  );
}
