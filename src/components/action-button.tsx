"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./providers";

/** Button that calls an API endpoint, shows a toast, then refreshes server data. */
export function ActionButton({
  url,
  method = "POST",
  body,
  className = "btn",
  confirm,
  success,
  redirectTo,
  children,
}: {
  url: string;
  method?: string;
  body?: object;
  className?: string;
  confirm?: string;
  success?: string;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast({ kind: "error", title: "Couldn't do that", body: data.error });
        if (data.sms && !data.sms.ok) toast({ kind: "error", title: "SMS failed to send", body: data.sms.error });
        else if (success) toast({ kind: "success", title: success });
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      }}
    >
      {busy ? <span className="spinner" /> : children}
    </button>
  );
}
