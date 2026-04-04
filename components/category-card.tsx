import Link from "next/link";

export function CategoryCard({
  imageUrl,
  title,
  description,
  href,
}: {
  imageUrl: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <article
      className="relative min-h-[20rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/75"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(4,8,20,0.08) 0%, rgba(4,8,20,0.9) 100%), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,208,111,0.16),transparent_45%)]" />
      <div className="relative flex h-full flex-col justify-end p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Categoria</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
        <p className="mt-3 max-w-sm text-sm leading-7 text-white/62">{description}</p>
        <Link href={href} className="mt-5 inline-flex text-sm font-medium text-amber-300 hover:text-amber-200">
          Esplora
        </Link>
      </div>
    </article>
  );
}
