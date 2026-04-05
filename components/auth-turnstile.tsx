"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";

export type AuthTurnstileHandle = {
  reset: () => void;
};

type AuthTurnstileProps = {
  onTokenChange: (token: string | null) => void;
  className?: string;
};

/** Public site key; pair the secret only in Supabase (Auth → Bot protection → Turnstile). */
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const isTurnstileConfigured = () => Boolean(siteKey);

export const AuthTurnstile = forwardRef<AuthTurnstileHandle, AuthTurnstileProps>(
  function AuthTurnstile({ onTokenChange, className }, ref) {
    const innerRef = useRef<TurnstileInstance>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        innerRef.current?.reset();
      },
    }));

    const handleSuccess = useCallback(
      (token: string) => onTokenChange(token),
      [onTokenChange],
    );

    const handleExpire = useCallback(() => onTokenChange(null), [onTokenChange]);

    const handleError = useCallback(() => onTokenChange(null), [onTokenChange]);

    if (!siteKey) {
      return (
        <p className="text-sm text-amber-500 dark:text-amber-400/90">
          CAPTCHA non configurato: aggiungi{" "}
          <span className="font-mono text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</span> e
          abilita Turnstile in Supabase (Auth → Protezione bot).
        </p>
      );
    }

    return (
      <div className={className}>
        <Turnstile
          ref={innerRef}
          siteKey={siteKey}
          onSuccess={handleSuccess}
          onExpire={handleExpire}
          onError={handleError}
          options={{
            language: "it",
            appearance: "interaction-only",
            theme: "auto",
            size: "flexible",
          }}
        />
      </div>
    );
  },
);
