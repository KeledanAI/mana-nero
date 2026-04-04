import { cn } from "@/lib/utils";

const socials = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/p/Mana-Nero-Fumetteria-61557209872088/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 1.09.044 1.613.115l.46.073v3.29a9 9 0 0 0-.837-.03c-1.184 0-1.642.45-1.642 1.62v2.49h2.403l-.413 1.877-.39 1.79h-1.6v8.04A10 10 0 0 0 22 12.07C22 6.505 17.523 2 12 2S2 6.505 2 12.07c0 4.868 3.46 8.926 8.058 9.849a10 10 0 0 0 1.043.168z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/mana_nero_fumetteria/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.9 4.9 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.9 4.9 0 0 1-1.153 1.772 4.9 4.9 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.9 4.9 0 0 1-1.772-1.153 4.9 4.9 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.066.217-1.79.465-2.428a4.9 4.9 0 0 1 1.153-1.772A4.9 4.9 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2m0 1.802c-2.67 0-2.986.01-4.04.058-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.684-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.055-.058 1.37-.058 4.041s.01 2.986.058 4.04c.045.977.207 1.506.344 1.858.182.466.399.8.748 1.15.35.35.684.567 1.15.749.353.136.882.3 1.857.344 1.054.048 1.37.058 4.041.058s2.987-.01 4.04-.058c.977-.045 1.506-.208 1.858-.344.466-.182.8-.4 1.15-.749.35-.35.567-.684.749-1.15.136-.352.3-.881.344-1.857.048-1.055.058-1.37.058-4.041s-.01-2.986-.058-4.04c-.045-.977-.208-1.505-.344-1.858a3.1 3.1 0 0 0-.749-1.15 3.1 3.1 0 0 0-1.15-.748c-.352-.137-.881-.3-1.857-.344-1.055-.048-1.37-.058-4.041-.058m0 3.063a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27m0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666m6.538-8.671a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@mana.nero.fumetteria",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48" />
      </svg>
    ),
  },
  {
    label: "Cardmarket",
    href: "https://www.cardmarket.com/it/YuGiOh/Users/ManaNeroFumetteria",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm4.5 2a.75.75 0 0 0-.75.75v1.5c0 .414.336.75.75.75h2.25v4.25a.75.75 0 0 0 .75.75h1.5a.75.75 0 0 0 .75-.75V11h2.25a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75z" />
      </svg>
    ),
  },
];

export function SocialLinks({
  size = "default",
  className,
}: {
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className={cn(
            "flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white",
            size === "lg" ? "h-11 w-11" : "h-9 w-9",
          )}
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
}

export function SocialLinksLabeled({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-sm text-white/60 transition hover:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
            {social.icon}
          </span>
          {social.label}
        </a>
      ))}
    </div>
  );
}
