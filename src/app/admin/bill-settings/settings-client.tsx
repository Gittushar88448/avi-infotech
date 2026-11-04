"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";
import { BillSettingsForm } from "@/components/bill-settings-form";
import type { BillSettingsDTO } from "@/lib/store/bill-settings";

export function BillSettingsClient({ initial }: { initial: BillSettingsDTO }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <BillSettingsForm
      initial={initial}
      onSaved={() => {
        toast({ kind: "success", title: "Bill settings saved" });
        router.refresh();
      }}
    />
  );
}
