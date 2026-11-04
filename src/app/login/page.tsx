import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense><LoginForm /></Suspense>
    </AuthShell>
  );
}
