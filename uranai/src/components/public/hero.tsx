import { siteConfig, DISPLAY_PRICE_JPY } from "@/config/site";

export function Hero({ storeName }: { storeName?: string }) {
  return (
    <section className="relative mb-7 mt-3 overflow-hidden rounded-[2rem] px-6 pb-7 pt-8 text-center fade-up">
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-gold-50/90 via-gold-300/70 to-gold-500/40 blur-[1px]" aria-hidden />
      <div className="pointer-events-none absolute -right-2 -top-16 h-44 w-44 rounded-full bg-night-800" aria-hidden />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent" aria-hidden />
      <div className="relative">
        {storeName ? (
          <p className="text-[12px] tracking-[0.25em] text-ink-muted">
            WELCOME TO <span className="text-gold-200">{storeName}</span>
          </p>
        ) : null}
        <h1 className="mt-3 font-serif text-[28px] font-bold leading-snug tracking-wide">
          <span className="text-gold-gradient">今日の星</span>を、
          <br />
          のぞいてみませんか。
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{siteConfig.tagline}</p>
        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-gold-300/30 bg-gold-300/[0.07] px-4 py-1.5">
          <span className="text-[12px] text-ink-muted">1回</span>
          <span className="font-display text-2xl font-semibold leading-none text-gold-200">{DISPLAY_PRICE_JPY}</span>
          <span className="text-[12px] text-gold-200">円（税込）</span>
        </div>
        <ol className="mt-6 grid grid-cols-3 gap-2 text-[11px] text-ink-muted">
          {["占いを選ぶ", "100円をお支払い", "結果をチェック"].map((s, i) => (
            <li key={s} className="rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-2.5">
              <span className="block font-display text-base text-gold-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
