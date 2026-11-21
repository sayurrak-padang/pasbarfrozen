import { Link, useNavigate } from "react-router-dom";
import { Newspaper, LockKeyhole, ScrollText, CircleHelp, ChevronRight, ArrowLeft } from "lucide-react";

export const INFO_LINKS = [
  { to: "/blog", label: "Blog", icon: Newspaper, testid: "info-blog" },
  { to: "/kebijakan-privasi", label: "Kebijakan Privasi", icon: LockKeyhole, testid: "info-privacy" },
  { to: "/syarat-ketentuan", label: "Syarat dan Ketentuan", icon: ScrollText, testid: "info-terms" },
  { to: "/bantuan", label: "Bantuan", icon: CircleHelp, testid: "info-help" },
];

// Satu baris menu: ikon, label, panah. Dipakai di halaman login dan halaman Akun.
export const MenuRow = ({ to, onClick, label, hint, icon: Icon, testid, danger }) => {
  const cls = `w-full flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-left transition-colors ${danger ? "text-red-600 hover:bg-red-50/70" : "text-slate-800 hover:bg-white/60"}`;
  const inner = (
    <>
      <Icon className={`w-[22px] h-[22px] shrink-0 ${danger ? "" : "text-emerald-700"}`} strokeWidth={1.8} />
      <span className="flex-1 min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[12px] font-normal text-muted-foreground truncate">{hint}</span>}
      </span>
      {!danger && <ChevronRight className="w-5 h-5 text-slate-400" />}
    </>
  );
  return to
    ? <Link to={to} className={cls} data-testid={testid}>{inner}</Link>
    : <button type="button" onClick={onClick} className={cls} data-testid={testid}>{inner}</button>;
};

export const MenuGroup = ({ children, testid }) => (
  <div className="glass rounded-2xl overflow-hidden divide-y divide-slate-200/70" data-testid={testid}>{children}</div>
);

export const InfoLinks = ({ testid = "info-links" }) => (
  <MenuGroup testid={testid}>
    {INFO_LINKS.map((l) => <MenuRow key={l.to} {...l} />)}
  </MenuGroup>
);

// Judul halaman dengan tombol kembali, bergaya kaca gelap seperti header utama.
export const PageHeader = ({ title, sub }) => {
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <div className="sticky top-0 z-30 px-3 pt-3">
      <div className="neon-lens rounded-[22px] flex items-center gap-2 px-2 py-2">
        <button onClick={back} aria-label="Kembali" data-testid="page-back"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-extrabold text-[17px] leading-tight truncate">{title}</h1>
          {sub && <p className="text-[11.5px] text-emerald-50/70 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
};
