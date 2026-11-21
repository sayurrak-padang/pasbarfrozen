import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, MessageCircle, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/InfoLinks";
import { useAuth } from "@/context/AuthContext";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { BLOG_POSTS, PRIVACY, TERMS, FAQ, UPDATED, STORE } from "@/lib/infoContent";

const useTitle = (t) => useEffect(() => {
  const prev = document.title;
  document.title = `${t} | ${STORE}`;
  window.scrollTo(0, 0);
  return () => { document.title = prev; };
}, [t]);

// Bila foto gagal dimuat, sembunyikan supaya tidak tampil ikon gambar rusak.
const hideImg = (e) => { e.currentTarget.style.visibility = "hidden"; };

// Paragraf sederhana: baris yang diawali "## " jadi subjudul.
const Body = ({ lines }) => lines.map((l, i) => l.startsWith("## ")
  ? <h2 key={i} className="font-bold text-[16px] text-slate-900 pt-2">{l.slice(3)}</h2>
  : <p key={i} className="text-[14.5px] leading-relaxed text-slate-700">{l}</p>);

export function BlogListPage() {
  useTitle("Blog");
  const [first, ...rest] = BLOG_POSTS;
  return (
    <div data-testid="blog-page">
      <PageHeader title="Blog" sub="Tips belanja, simpan, dan masak bahan segar" />
      <div className="px-4 py-4 space-y-3">
        <Link to={`/blog/${first.slug}`} className="block glass rounded-2xl overflow-hidden" data-testid={`blog-card-${first.slug}`}>
          <img src={first.image} alt="" onError={hideImg} className="w-full h-44 object-cover bg-emerald-100" loading="lazy" />
          <div className="p-4">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Terbaru · {first.date}</p>
            <h2 className="font-extrabold text-[17px] leading-snug mt-1">{first.title}</h2>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{first.excerpt}</p>
          </div>
        </Link>
        {rest.map((p) => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="flex gap-3 glass rounded-2xl p-3" data-testid={`blog-card-${p.slug}`}>
            <img src={p.image} alt="" onError={hideImg} className="w-24 h-24 rounded-xl object-cover bg-emerald-100 shrink-0" loading="lazy" />
            <div className="min-w-0">
              <h2 className="font-bold text-[15px] leading-snug line-clamp-2">{p.title}</h2>
              <p className="text-[12.5px] text-muted-foreground mt-1 line-clamp-2">{p.excerpt}</p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {p.minutes} menit baca</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  useTitle(post?.title || "Blog");
  if (!post) return (
    <div><PageHeader title="Blog" /><p className="p-6 text-center text-muted-foreground">Artikel tidak ditemukan. <Link to="/blog" className="text-primary font-semibold">Lihat semua artikel</Link></p></div>
  );
  return (
    <div data-testid="blog-post-page">
      <PageHeader title="Blog" />
      <article className="px-4 py-4">
        <img src={post.image} alt="" onError={hideImg} className="w-full h-52 rounded-2xl object-cover bg-emerald-100" />
        <p className="text-[12px] text-slate-500 mt-4">{post.date} · {post.minutes} menit baca</p>
        <h1 className="font-extrabold text-[22px] leading-tight mt-1">{post.title}</h1>
        <div className="glass rounded-2xl p-4 mt-4 space-y-3"><Body lines={post.body} /></div>
        <Link to="/" className="neon-btn mt-5 flex items-center justify-center h-12 rounded-2xl font-bold" data-testid="blog-shop-cta">Belanja Sekarang</Link>
      </article>
    </div>
  );
}

const DocPage = ({ title, sections, testid, intro }) => {
  useTitle(title);
  return (
    <div data-testid={testid}>
      <PageHeader title={title} sub={`Terakhir diperbarui ${UPDATED}`} />
      <div className="px-4 py-4 space-y-3">
        {intro}
        {sections.map((s, i) => (
          <section key={s.h} className="glass rounded-2xl p-4 space-y-2">
            <h2 className="font-bold text-[15.5px] text-slate-900">{i + 1}. {s.h}</h2>
            {s.p.map((t, j) => <p key={j} className="text-[14px] leading-relaxed text-slate-700">{t}</p>)}
          </section>
        ))}
        <p className="text-center text-xs text-muted-foreground py-2">Ada pertanyaan? <Link to="/bantuan" className="text-primary font-semibold">Hubungi kami</Link></p>
      </div>
    </div>
  );
};

export const PrivacyPage = () => <DocPage title="Kebijakan Privasi" sections={PRIVACY} testid="privacy-page" />;
export const TermsPage = () => <DocPage title="Syarat dan Ketentuan" sections={TERMS} testid="terms-page" />;

const PROMISES = [
  { icon: ShieldCheck, t: "Garansi segar", d: "Barang tidak sesuai? Kami ganti atau refund." },
  { icon: Truck, t: "Antar sesuai jadwal", d: "Pilih jam antar 09.00 sampai 18.00." },
  { icon: RotateCcw, t: "Refund fleksibel", d: "Ke Saldo atau ke rekening Anda." },
];

export function HelpPage() {
  useTitle("Bantuan");
  const { user } = useAuth();
  const openChat = () => window.dispatchEvent(new Event("rsp:open-chat"));
  return (
    <div data-testid="help-page">
      <PageHeader title="Bantuan" sub="Pertanyaan yang sering ditanyakan" />
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {PROMISES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="glass rounded-2xl p-3 text-center">
              <Icon className="w-6 h-6 mx-auto text-emerald-700" strokeWidth={1.8} />
              <p className="text-[12px] font-bold mt-1.5 leading-tight">{t}</p>
              <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">{d}</p>
            </div>
          ))}
        </div>
        {FAQ.map((g) => (
          <section key={g.group} className="glass rounded-2xl px-4 py-2">
            <h2 className="font-bold text-[13px] uppercase tracking-wide text-emerald-800 pt-2">{g.group}</h2>
            <Accordion type="single" collapsible>
              {g.items.map((f, i) => (
                <AccordionItem key={f.q} value={`${g.group}-${i}`} className="border-slate-200/70 last:border-b-0">
                  <AccordionTrigger className="text-left text-[14.5px] font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-[14px] leading-relaxed text-slate-700">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
        <div className="neon-lens rounded-2xl p-4">
          <p className="font-bold">Masih butuh bantuan?</p>
          <p className="text-[13px] text-emerald-50/75 mt-0.5">Kirim pesan ke admin, kami balas secepatnya di jam operasional.</p>
          {user
            ? <button onClick={openChat} className="neon-btn mt-3 w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2" data-testid="help-open-chat"><MessageCircle className="w-5 h-5" /> Chat dengan Admin</button>
            : <Link to="/login?mode=masuk" className="neon-btn mt-3 w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2" data-testid="help-login-chat"><MessageCircle className="w-5 h-5" /> Masuk untuk chat Admin</Link>}
        </div>
      </div>
    </div>
  );
}
