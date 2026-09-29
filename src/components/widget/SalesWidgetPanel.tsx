import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Loader2, Download, Check } from "lucide-react";

interface WidgetData {
  today_revenue: number;
  today_count: number;
  revenue_7d: number;
  revenue_30d: number;
  leads: number;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-widget`;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildScript(token: string) {
  return `/* Riot Vips - Painel de Faturamento. Cole no app Scriptable e nomeie como "Riot" */
const TOKEN = "${token}";
const API_URL = "${FN_URL}?token=" + TOKEN;

const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let data = { today_revenue: 0, today_count: 0, revenue_7d: 0, revenue_30d: 0, leads: 0 };
try {
  const req = new Request(API_URL);
  req.timeoutInterval = 15;
  data = await req.loadJSON();
} catch (e) {}

const CYAN = new Color("#33ccff");
const BLUE = new Color("#2b7fe0");
const TEXT = new Color("#f2feff");
const MUTED = new Color("#7d8ea8");
const LINE = new Color("#1d2a3d");

const w = new ListWidget();
const bg = new LinearGradient();
bg.colors = [new Color("#0a1018"), new Color("#0d1a2b")];
bg.locations = [0, 1];
w.backgroundGradient = bg;
w.setPadding(14, 15, 14, 15);
w.url = "https://riotvips.com";

const head = w.addStack();
head.centerAlignContent();
const brand = head.addText("RIOT");
brand.textColor = CYAN;
brand.font = new Font("Menlo-Bold", 11);
const brand2 = head.addText(" VIPS");
brand2.textColor = TEXT;
brand2.font = new Font("Menlo-Regular", 11);
head.addSpacer();
const live = head.addText("SINCRONIZADO");
live.textColor = MUTED;
live.font = new Font("Menlo-Regular", 7);
const dot = head.addText(" \\u25CF");
dot.textColor = CYAN;
dot.font = Font.systemFont(8);

w.addSpacer(12);

const main = w.addStack();
main.centerAlignContent();

const left = main.addStack();
left.layoutVertically();
const label = left.addText("FATURAMENTO DE HOJE");
label.textColor = MUTED;
label.font = new Font("Menlo-Regular", 7);
left.addSpacer(3);
const value = left.addText(brl(data.today_revenue));
value.textColor = TEXT;
value.font = new Font("Menlo-Bold", 24);
value.minimumScaleFactor = 0.6;
value.lineLimit = 1;
main.addSpacer();

const badge = main.addStack();
badge.backgroundColor = new Color("#33ccff", 0.14);
badge.cornerRadius = 8;
badge.setPadding(5, 8, 5, 8);
badge.layoutVertically();
badge.centerAlignContent();
const bc = badge.addText(String(data.today_count));
bc.textColor = CYAN;
bc.font = new Font("Menlo-Bold", 14);
const bl = badge.addText(data.today_count === 1 ? "venda" : "vendas");
bl.textColor = CYAN;
bl.font = Font.systemFont(8);

w.addSpacer(10);

const sep = w.addStack();
sep.backgroundColor = LINE;
sep.size = new Size(0, 1);
sep.addSpacer();

w.addSpacer(10);

const row = w.addStack();
const col = (title, val, accent) => {
  const s = row.addStack();
  s.layoutVertically();
  const sub = s.addText(title.toUpperCase());
  sub.textColor = MUTED;
  sub.font = new Font("Menlo-Regular", 7);
  s.addSpacer(2);
  const t = s.addText(val);
  t.textColor = accent ? BLUE : TEXT;
  t.font = new Font("Menlo-Bold", 11);
  t.minimumScaleFactor = 0.6;
  t.lineLimit = 1;
  row.addSpacer();
};
col("7 dias", brl(data.revenue_7d), false);
col("30 dias", brl(data.revenue_30d), false);
col("Leads", String(data.leads), true);

w.refreshAfterDate = new Date(Date.now() + 900000);

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  w.presentMedium();
}
Script.complete();
`;
}

export function SalesWidgetPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<WidgetData | null>(null);
  const [copied, setCopied] = useState<"token" | "script" | null>(null);

  const loadPreview = useCallback(async (t: string) => {
    if (!t) return;
    try {
      const res = await fetch(`${FN_URL}?token=${t}`);
      const json = await res.json();
      if (json?.ok) setPreview(json);
    } catch {
      /* preview é opcional */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("widget_token")
        .eq("id", user.id)
        .maybeSingle();
      const t = (data as any)?.widget_token || "";
      setToken(t);
      setLoading(false);
      if (t) loadPreview(t);
    })();
  }, [user, loadPreview]);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const newToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase
        .from("profiles")
        .update({ widget_token: newToken } as any)
        .eq("id", user.id);
      if (error) throw error;
      setToken(newToken);
      loadPreview(newToken);
      toast({ title: "Token gerado!", description: "O token anterior foi invalidado." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (what: "token" | "script") => {
    const text = what === "token" ? token : buildScript(token);
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: what === "token" ? "Token copiado!" : "Script copiado!" });
  };

  const Step = ({ n, title }: { n: number; title: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 font-mono">
        {n}
      </span>
      <h3 className="font-semibold text-sm">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Preview */}
            <div
              className="rounded-2xl border border-primary/20 p-5 mb-2 animate-fade-in"
              style={{ background: "linear-gradient(145deg, hsl(210 45% 6%), hsl(212 55% 10%))" }}
            >
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-primary tracking-wide">RIOT</span>
                <span className="font-mono text-xs tracking-wide text-foreground">VIPS</span>
                <span className="ml-auto text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Sincronizado
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>

              <div className="flex items-center gap-4 mt-5">
                <div className="min-w-0">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    Faturamento de hoje
                  </p>
                  <p className="font-mono text-3xl font-bold mt-1 truncate">{brl(preview?.today_revenue ?? 0)}</p>
                </div>
                <div className="ml-auto shrink-0 rounded-lg bg-primary/15 px-3 py-2 text-center">
                  <p className="font-mono text-lg font-bold text-primary leading-none">{preview?.today_count ?? 0}</p>
                  <p className="text-[10px] text-primary/80 mt-0.5">
                    {preview?.today_count === 1 ? "venda" : "vendas"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border/60 my-4" />

              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "7 dias", v: brl(preview?.revenue_7d ?? 0), a: false },
                  { l: "30 dias", v: brl(preview?.revenue_30d ?? 0), a: false },
                  { l: "Leads", v: String(preview?.leads ?? 0), a: true },
                ].map((c) => (
                  <div key={c.l}>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{c.l}</p>
                    <p className={`font-mono text-sm font-bold mt-0.5 truncate ${c.a ? "text-accent" : ""}`}>{c.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground mb-8">
              Prévia gerada com os seus números reais
            </p>

            {/* Step 1 */}
            <div className="mb-8">
              <Step n={1} title="Gere seu token" />
              {token ? (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/40 border border-border/50 mb-3">
                    <code className="font-mono text-xs truncate flex-1">{token}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy("token")} title="Copiar token">
                      {copied === "token" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button className="w-full btn-gradient border-0" onClick={() => copy("script")}>
                    {copied === "script" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copiar Script Completo
                  </Button>
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3 inline-flex items-center justify-center gap-1.5"
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Gerar um novo token (invalida o anterior)
                  </button>
                </>
              ) : (
                <Button className="w-full btn-gradient border-0" onClick={generate} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Gerar token
                </Button>
              )}
            </div>

            {/* Step 2 */}
            <div className="mb-8">
              <Step n={2} title="Instale o Scriptable" />
              <a
                href="https://apps.apple.com/br/app/scriptable/id1405459188"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar na App Store
                </Button>
              </a>
            </div>

            {/* Step 3 */}
            <div className="mb-6">
              <Step n={3} title="Adicione o widget" />
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
                <li>Abra o <strong className="text-foreground">Scriptable</strong> e toque em <strong className="text-foreground">+</strong> (novo script).</li>
                <li>Cole o script (botão <strong className="text-foreground">Copiar Script Completo</strong>) e nomeie como <strong className="text-foreground">Riot</strong>.</li>
                <li>Na tela inicial, segure num espaço vazio → <strong className="text-foreground">+</strong> → busque <strong className="text-foreground">Scriptable</strong> (tamanho Médio).</li>
                <li>Toque no widget → <strong className="text-foreground">Script: Riot</strong>. Pronto.</li>
              </ol>
            </div>
          </>
        )}
    </div>
  );
}
