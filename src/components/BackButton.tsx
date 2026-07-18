import { ArrowLeft } from "lucide-react";
import { useRouter, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function BackButton({ fallback = "/circles" }: { fallback?: string }) {
  const router = useRouter();
  const navigate = useNavigate();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: fallback, replace: true });
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label="Retour"
      className="h-10 w-10"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}