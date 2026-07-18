import { ArrowLeft } from "lucide-react";
import { useRouter, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function BackButton({
  fallback = "/circles",
  variant = "text",
}: {
  fallback?: string;
  variant?: "icon" | "text";
}) {
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
      size={variant === "icon" ? "icon" : "default"}
      onClick={handleClick}
      aria-label="Retour"
      className={
        variant === "text"
          ? "h-10 px-2 text-sm font-medium text-muted-foreground hover:text-foreground -ml-2"
          : "h-10 w-10"
      }
    >
      <ArrowLeft className={variant === "text" ? "h-4 w-4 mr-1" : "h-5 w-5"} />
      {variant === "text" && "Retour"}
    </Button>
  );
}