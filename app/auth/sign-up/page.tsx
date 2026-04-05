import type { Metadata } from "next";

import { SignUpForm } from "@/components/sign-up-form";

export const metadata: Metadata = {
  title: "Registrati",
  description:
    "Registrati al Mana Nero con conferma via link email (senza password).",
};

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
