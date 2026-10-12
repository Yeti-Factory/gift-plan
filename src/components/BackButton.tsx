import { ArrowLeft } from "lucide-react";
import { useRouter, useNavigate, useCanGoBack } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function BackButton({
  fallback = "/",
  variant = "text",
}: {
  fallback?: string;
  variant?: "icon" | "text";
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  function handleClick() {
    if (canGoBack) {
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
      className={variant === "text" ? "h-11 px-3 text-sm font-medium" : "h-11 w-11"}
    >
      <ArrowLeft aria-hidden="true" className={variant === "text" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {variant === "text" && "Retour"}
    </Button>
  );
}
