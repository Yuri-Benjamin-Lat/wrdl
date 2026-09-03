"use client";

import { useEffect } from "react";

import { SupportingError } from "@/components/support/supporting-state";
import { reportApplicationError } from "@/lib/observability";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportApplicationError("page_render_failed", error);
  }, [error]);

  return <SupportingError onRetry={retry} />;
}
