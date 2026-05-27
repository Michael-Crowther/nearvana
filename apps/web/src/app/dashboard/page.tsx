"use client";

import { useUser } from "@/src/context/UserContext";
import { redirect } from "next/navigation";
import { authClient } from "@nearvana/auth";
import { Button } from "@nearvana/ui/components/button";
import { PrettyJson } from "@nearvana/ui/custom/PrettyJson";
import { useEffect } from "react";
import { toast } from "@nearvana/ui/components/sonner";

export default function Dashboard() {
  const { user } = useUser();

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

  return (
    <div className="mx-auto max-w-7xl p-4 sm:px-6 lg:px-8">
      <Button onClick={handleSignout}>Signout</Button>
      <PrettyJson>{user}</PrettyJson>
      {user?.role === "builder" && <p>This is the builder dashboard.</p>}
      {user?.role === "subcontractor" && (
        <p>This is the subcontractor dashboard.</p>
      )}
    </div>
  );
}
