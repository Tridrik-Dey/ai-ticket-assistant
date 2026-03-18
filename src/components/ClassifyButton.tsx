import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";

type ClassifyButtonProps = {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  loading: boolean;
};

export function ClassifyButton({ onClick, loading }: ClassifyButtonProps) {
  return (
    <Button type="button" onClick={onClick} disabled={loading} size="sm" variant={loading ? "outline" : "default"}>
      {loading ? "Classifying..." : "Classify with AI"}
    </Button>
  );
}
