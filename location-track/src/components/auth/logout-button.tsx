"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

type LogoutButtonProps = {
  label: string;
  locale: Locale;
};

export function LogoutButton({ label, locale }: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await signOut();
    } finally {
      router.replace(`/${locale}/login`);
      router.refresh();
    }
  }

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={handleLogout}
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  );
}
