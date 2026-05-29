"use client";

import { useUser } from "@/src/context/UserContext";
import { redirect } from "next/navigation";
import { authClient } from "@nearvana/auth";
import { Button } from "@nearvana/ui/components/button";
import { useEffect, useState } from "react";
import { toast } from "@nearvana/ui/components/sonner";
import { useTRPC } from "@/src/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@nearvana/ui/components/card";

export default function Dashboard() {
  const { user } = useUser();
  const trpc = useTRPC();
  const {
    data: searchResults,
    refetch: refetchSearchResults,
    isFetching: isSearching,
  } = useQuery({
    ...trpc.searchEvents.searchEvents.queryOptions(),
    enabled: false,
  });

  useEffect(() => {
    if (window.localStorage.getItem("showWelcomeToast") === "true" && user) {
      setTimeout(() => {
        toast.success(`Welcome back, ${user.name}!`, {
          style: { color: "green" },
        });
        window.localStorage.removeItem("showWelcomeToast");
      }, 10);
    }
  }, [user]);

  const handleSignout = async (e: React.FormEvent) => {
    e.preventDefault();
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          redirect("/login");
        },
      },
    });
  };

  const handleSearchEvents = async () => {
    const { data, error } = await refetchSearchResults();
    console.log("data", data);
    console.log("error", error);
  };

  const events = searchResults?.parsedEvents ?? [];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={handleSignout}>Signout</Button>
        <Button onClick={handleSearchEvents} disabled={isSearching}>
          {isSearching ? "Searching..." : "Search Events"}
        </Button>
      </div>

      <section className="bg-background p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Events for you</h2>
          <p className="text-sm text-muted-foreground">
            {events.length} result{events.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {events.map((event) => (
            <a
              key={event.id}
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card className="overflow-hidden rounded-2xl border transition hover:border-primary/40 hover:shadow-md">
                <div className="flex min-h-36 flex-col sm:flex-row">
                  <div className="h-36 w-full shrink-0 bg-muted sm:h-auto sm:w-44">
                    <EventImage src={event.imageUrl} alt={event.title} />
                  </div>

                  <div className="flex-1 p-4">
                    <p className="line-clamp-2 text-base font-semibold">
                      {event.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(event.startDate).toLocaleString()}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {event.venue ?? event.location}
                    </p>
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                      {event.sourceUrl}
                    </p>
                  </div>
                </div>
              </Card>
            </a>
          ))}

          {!isSearching && events.length === 0 ? (
            <Card className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No events yet. Click &quot;Search Events&quot; to load results.
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EventImage({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const hasImage = Boolean(src) && !broken;

  if (!hasImage) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        Image placeholder
      </div>
    );
  }

  return (
    <img
      src={src ?? ""}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
      loading="lazy"
    />
  );
}
