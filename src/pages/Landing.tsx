import { useNavigate } from "react-router-dom";
import {
  Bot, Zap, Shield, BarChart3, CreditCard, ArrowRight, CheckCircle,
  Users, TrendingUp, Repeat, Target, Star, Layers, Globe,
  LineChart, Send, Filter,
  ShoppingCart, Users2, FileText, Play, EyeOff, Gift, Megaphone, Brain,
  RefreshCw, Plug, MessageCircle,
  Wallet, Link2, Bell, Smartphone, ScrollText, Gauge, UserCheck, CalendarClock,
  Copy, FlaskConical, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ---------------- Data ---------------- */

const navLinks = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Novidades", href: "#novidades" },
  { label: "Ferramentas", href: "#tools" },
  { label: "Depoimentos", href: "#testimonials" },
  { label: "Preços", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const heroBullets = [
  "Plano gratuito, sem cartão",
  "Setup em menos de 5 minutos",
  "Suporte real em português",
];

const toolPills = [
  { icon: Filter, label: "Criar funis de vendas" },
  { icon: Gift, label: "Bônus e premiações" },
  { icon: EyeOff, label: "Cloaker nativo" },
  { icon: Zap, label: "Taxa atrativa" },
  { icon: Send, label: "Telegram nativo" },
  { icon: Megaphone, label: "Broadcast segmentado" },
  { icon: ShoppingCart, label: "Checkout PIX" },
  { icon: FileText, label: "Relatórios detalhados" },
  { icon: RefreshCw, label: "Renovação automática" },
  { icon: Wallet, label: "Painel financeiro" },
  { icon: Link2, label: "Links personalizados" },
  { icon: Bell, label: "Alertas PushCut" },
  { icon: Smartphone, label: "Widget iOS de vendas" },
  { icon: Users, label: "Base de clientes" },
];

const bigFeatures = [
  { icon: ShoppingCart, title: "Checkout PIX modular", desc: "Escolha o template, personalize a copy, ative order bump e upsell. Um checkout feito para converter, sem depender de dev." },
  { icon: Users2, title: "Área VIP no Telegram", desc: "Gerencie assinantes, planos e liberação automática de acesso — experiência premium para o seu cliente." },
  { icon: FileText, title: "Página de vendas", desc: "Ative mensagens de /start com mídia, áudio, VSL e botões dinâmicos direto no bot, sem hospedagem externa." },
  { icon: Repeat, title: "Vendas fixas ou recorrentes", desc: "Assinaturas mensais, trimestrais, anuais ou vitalícias — no automático, sem burocracia." },
  { icon: Filter, title: "Funis que aumentam o ticket", desc: "Alavanque suas estratégias com Upsell, Downsell, Order Bumps, Cross-Bot e cadências inteligentes." },
  { icon: Shield, title: "Cloaker & anti-clone", desc: "Proteção nativa contra spies, clones e forwards. Seus links e conteúdos ficam blindados do começo ao fim." },
];

const stats = [
  { value: "+R$ 5Mi", label: "movimentados na plataforma" },
  { value: "+500", label: "usuários vendendo na Riot Vips" },
  { value: "99%", label: "de aprovação em pagamentos PIX" },
  { value: "<3s", label: "para liberar o acesso VIP" },
];

const checkoutTemplates = ["Padrão", "Clean", "Moderno", "Sales"];
const paletteDots = ["#38bdf8", "#0ea5e9", "#2563eb", "#7c3aed", "#f59e0b", "#f8fafc"];

const dashboardMetrics = [
  { label: "Total faturado", value: "R$ 1.352.692,14", trend: "▲ 237,4%", up: true },
  { label: "Vendas líquidas", value: "R$ 1.329.576,71", trend: "▲ 237,4%", up: true },
  { label: "Ticket médio", value: "R$ 26,85", trend: "▼ 1,7%", up: false },
  { label: "Taxa de aprovação", value: "99,0%", trend: "no período", up: true },
];

const dashboardHighlights = [
  { icon: Plug, title: "Integrações facilitadas", desc: "Telegram, PIX, e-mail e webhooks em poucos cliques." },
  { icon: BarChart3, title: "Relatórios detalhados", desc: "Conversão, abandono e performance por bot e período." },
  { icon: LineChart, title: "Histórico completo", desc: "Gráficos de 7, 30 e 90 dias com /starts, PIX e vendas aprovadas." },
  { icon: RefreshCw, title: "Atualização em tempo real", desc: "Cada venda aprovada aparece no dashboard em segundos." },
];

const toolboxItems = [
  { icon: ShoppingCart, label: "Checkout integrado" },
  { icon: Users2, label: "Área VIP no Telegram" },
  { icon: FileText, label: "Páginas de vendas" },
  { icon: Filter, label: "Funis de vendas" },
  { icon: RefreshCw, label: "Recuperação de vendas" },
  { icon: EyeOff, label: "Cloaker nativo" },
  { icon: MessageCircle, label: "Disparo Telegram" },
  { icon: Bot, label: "Bots ilimitados" },
  { icon: LineChart, label: "Relatórios & analytics" },
  { icon: Plug, label: "Integrações & tracking" },
  { icon: Gift, label: "Bônus & premiações" },
  { icon: Zap, label: "Taxa atrativa" },
  { icon: Wallet, label: "Financeiro completo" },
  { icon: Users, label: "Gestão de clientes" },
  { icon: Link2, label: "Links personalizados" },
  { icon: Bell, label: "Central de alertas" },
  { icon: Smartphone, label: "Widget iOS" },
  { icon: ScrollText, label: "Log de atividade" },
  { icon: Gauge, label: "Status PIX em tempo real" },
  { icon: FlaskConical, label: "Teste A/B" },
  { icon: UserCheck, label: "Aprovação automática" },
  { icon: CalendarClock, label: "Preço automático" },
  { icon: Copy, label: "Duplicar bot" },
  { icon: Shield, label: "Contingência de bots" },
];

const whatsNew = [
  { icon: Wallet, tag: "Novo", title: "Página Financeiro", desc: "Entradas, taxas, líquido e transações recentes com filtro por período — tudo em um lugar só." },
  { icon: Users, tag: "Novo", title: "Central de Clientes", desc: "Base completa de leads e assinantes com filtros, histórico de compras e perfil detalhado de cada cliente." },
  { icon: Link2, tag: "Novo", title: "Links Personalizados", desc: "Encurtador próprio com domínio verificado, balanceamento entre bots, cloaker e métricas de cliques por dia, bot e domínio." },
  { icon: Bell, tag: "Novo", title: "Central de Alertas (PushCut)", desc: "Receba no iPhone cada venda aprovada, PIX gerado, queda de bot ou falha de gateway — em tempo real." },
  { icon: Smartphone, tag: "Novo", title: "Widget iOS de vendas", desc: "Acompanhe faturamento e vendas do dia direto na tela de início do iPhone, com as cores da Riot Vips." },
  { icon: Gauge, tag: "Novo", title: "Status PIX ao vivo", desc: "Monitor de saúde do gateway nas últimas 24h: emissões, aprovações e diagnóstico de falhas por bot." },
  { icon: ScrollText, tag: "Novo", title: "Log de Atividade", desc: "Linha do tempo de tudo que acontece na operação, com modal de detalhes e payload completo do evento." },
  { icon: BarChart3, tag: "Atualizado", title: "Estatísticas com funil", desc: "Novo visual com funil de conversão, ticket médio, churn, abandono e comparativos por período." },
  { icon: Layers, tag: "Atualizado", title: "Planos com arrastar e soltar", desc: "Reordene assinaturas na hora e personalize 100% do order bump: texto, descrição e o preço no botão." },
];

const testimonials = [
  { name: "Marcos R.", role: "Vendedor ativo", text: "Fiz R$ 47k no primeiro mês. O PIX automático libera acesso em 3 segundos, meus clientes ficam impressionados.", rating: 5 },
  { name: "Julia S.", role: "Vendedor ativo", text: "O downsell automático recuperou 32% dos abandonos. É como ter um vendedor 24h trabalhando por mim.", rating: 5 },
  { name: "Pedro L.", role: "Vendedor ativo", text: "Migrei de 3 ferramentas para a Riot Vips. Simples, rápido e o suporte é excelente.", rating: 5 },
  { name: "Bruno C.", role: "Vendedor ativo", text: "A recuperação automática de vendas é impressionante. Recupero 40% das vendas abandonadas sem fazer nada.", rating: 5 },
  { name: "Rafael M.", role: "Vendedor ativo", text: "O cloaker da Riot Vips protege perfeitamente meu conteúdo. Nunca mais tive problema com clones.", rating: 5 },
  { name: "Diego A.", role: "Vendedor ativo", text: "Mesmo iniciante consegui criar minha primeira venda em 30 minutos. Programa fácil de usar.", rating: 5 },
];

const faqs = [
  { q: "Preciso saber programar?", a: "Não. Toda a configuração é feita por interface visual em minutos, sem uma linha de código." },
  { q: "Quanto custa para começar?", a: "Você cria sua conta gratuitamente e testa todas as funcionalidades. Cobramos apenas R$ 0,60 fixo por transação aprovada — sem percentual." },
  { q: "Como funciona o PIX?", a: "Você conecta sua chave API da RevantPay uma única vez. Nossos bots geram QR Codes automáticos, confirmam pagamento e liberam o VIP em segundos." },
  { q: "Meu conteúdo fica protegido?", a: "Sim. Anti-clone com protect_content nativo do Telegram, cloaker anti-spy nos links e blacklist automática." },
  { q: "Posso ter mais de um bot?", a: "Sim, quantos você quiser. A contingência distribui tráfego entre bots para você nunca perder vendas." },
  { q: "Como funciona o A/B testing?", a: "Crie 2 variantes (mensagem, mídia, plano, preço, order bump) e o sistema divide o tráfego 50/50 automaticamente." },
  { q: "Consigo ver histórico de vendas?", a: "Sim. Gráfico diário de 7/30/90 dias com /starts, PIX gerados, pendentes, aprovados e receita por bot ou consolidado." },
  { q: "Preciso de conta na RevantPay?", a: "Sim. A RevantPay é a gateway de PIX. Você cria conta grátis, pega sua API key e cola no painel — pronto." },
];

/* ---------------- Component ---------------- */

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-primary/10 rounded-full blur-[160px]" />
        <div className="absolute top-[40%] -left-40 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px]" />
      </div>

      {/* Floating pill nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1100px,calc(100%-2rem))]">
        <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-full bg-card/80 backdrop-blur-xl border border-border/60 shadow-[0_10px_40px_-10px_hsl(200_100%_60%/0.25)]">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 pl-2 pr-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_20px_hsl(200_100%_60%/0.5)]">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">Riot Vips</span>
          </button>
          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-secondary/60 transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-10 px-5 text-sm">
              Ir para o dashboard
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur text-xs md:text-sm text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Bots · Checkout PIX · Assinatura VIP · Downsell · Cloaker — tudo num só lugar
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            A plataforma do <span className="gradient-text">futuro</span>
            <br />chegou
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            A única plataforma que une bots do Telegram, checkout PIX modular, área VIP, cloaker,
            recuperação de vendas e várias outras ferramentas em um só lugar. Saia do zero aos 7 dígitos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 h-14 px-8 rounded-full text-base">
              Criar conta grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="h-14 px-8 rounded-full text-base border-border/60 bg-card/40 hover:bg-secondary/60">
              Ver funcionalidades
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {heroBullets.map(b => (
              <span key={b} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" /> {b}
              </span>
            ))}
          </div>
        </div>

        {/* Preview cards */}
        <div className="max-w-6xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card p-6">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Visão completa das suas vendas</h3>
            <p className="text-sm text-muted-foreground mb-6">Um panorama claro de cada oferta, do /start ao pós-venda.</p>
            <p className="text-xs text-muted-foreground">Vendas, conversão e recuperação num lugar só.</p>
          </div>
          <div className="glass-card p-6">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
              <LineChart className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Estatísticas em tempo real</h3>
            <p className="text-sm text-muted-foreground mb-6">Métricas que atualizam na hora pra você decidir com dados.</p>
            <p className="text-xs text-muted-foreground">Ticket médio, abandono e recompra ao vivo.</p>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Faturamento</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/>Gerado</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"/>Pago</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold gradient-text">R$ 48.920</span>
              <span className="text-xs text-primary flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />32% vs. ontem</span>
            </div>
            <svg viewBox="0 0 300 90" className="w-full">
              <defs>
                <linearGradient id="fillPago" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(200 100% 60%)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="hsl(200 100% 60%)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,70 C40,55 60,30 100,35 C140,40 170,15 210,20 C240,24 270,45 300,30 L300,90 L0,90 Z" fill="url(#fillPago)" />
              <path d="M0,70 C40,55 60,30 100,35 C140,40 170,15 210,20 C240,24 270,45 300,30" fill="none" stroke="hsl(200 100% 60%)" strokeWidth="2" />
              <path d="M0,80 C40,75 70,65 110,68 C150,72 180,60 220,62 C250,64 275,72 300,68" fill="none" stroke="hsl(38 92% 55%)" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </section>

      {/* Tools marquee */}
      <section className="py-14 overflow-hidden border-y border-border/40 bg-card/30">
        <div className="flex gap-3 animate-[marquee_35s_linear_infinite]" style={{ width: "max-content" }}>
          {[...toolPills, ...toolPills].map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={i} className="flex items-center gap-2 shrink-0 px-5 py-2.5 rounded-full bg-background border border-border/60">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm">{t.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-3 animate-[marquee_45s_linear_infinite_reverse]" style={{ width: "max-content" }}>
          {[...toolboxItems, ...toolboxItems].map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={i} className="flex items-center gap-2 shrink-0 px-5 py-2.5 rounded-full bg-background border border-border/60">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm">{t.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Venda mais / big features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">UMA PLATAFORMA, TUDO INTEGRADO</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Venda mais e escale sem medo</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Você já vende. A pergunta é: quanto está deixando na mesa com taxa alta e ferramentas espalhadas?
              Na Riot Vips, o essencial vive num lugar só.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bigFeatures.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass-card-hover p-7">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats section (light band) */}
      <section className="py-24 px-6 bg-gradient-to-b from-primary/[0.04] via-accent/[0.04] to-primary/[0.04] border-y border-border/40">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">FEITA PARA QUEM VIVE DE PROJETO DIGITAL</div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            A plataforma onde o negócio<br />digital acontece
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-10">
            O volume que nossos produtores já movimentam na Riot Vips — em números reais.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(s => (
              <div key={s.label} className="glass-card p-8 text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">{s.value}</div>
                <div className="text-xs md:text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checkout modular */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">PAGAMENTO SEM ATRITO NO TELEGRAM</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Alta <span className="gradient-text">aprovação</span> e compra em 1 clique
            </h2>
            <p className="text-muted-foreground mb-6">
              Nada de checkout externo, redirecionamento ou formulário longo. O lead clica no botão dentro
              do bot, recebe o QR Code e o PIX Copia e Cola — paga e o acesso VIP é liberado em segundos.
              E ele pode voltar quantas vezes quiser para comprar novas ofertas.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <span className="px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> 99% de aprovação no PIX
              </span>
              <span className="px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Recompra ilimitada no mesmo bot
              </span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "QR Code e PIX Copia e Cola direto no chat",
                "Order bump e upsell nativos, sem sair do Telegram",
                "Liberação automática do VIP em menos de 3 segundos",
                "O mesmo lead pode comprar várias ofertas diferentes",
              ].map(li => (
                <li key={li} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" /> {li}
                </li>
              ))}
            </ul>
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-12 px-7">
              Ativar meus bots <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold">Pagamento no bot</h3>
              <span className="text-xs text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/> aprovando agora
              </span>
            </div>
            <div className="p-5 rounded-xl border border-border/60 bg-background/50 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Aprovação de pagamentos</span>
                <span className="font-bold gradient-text text-lg">99,0% <span className="text-xs text-primary">▲ 0,4pp</span></span>
              </div>
              <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: "99%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">PIX confirmado em segundos — sem redirecionar o lead.</p>
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Template do checkout</div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {checkoutTemplates.map((t, i) => (
                <div key={t} className={`p-4 rounded-xl border ${i === 0 ? "border-primary bg-primary/10" : "border-border/60 bg-background/40"}`}>
                  <div className="h-2 rounded-full bg-muted/60 mb-1.5" />
                  <div className="h-2 rounded-full bg-muted/40 mb-2 w-2/3" />
                  <div className={`h-3 rounded-full mb-2 ${i === 0 ? "bg-primary" : "bg-muted/50"}`} />
                  <div className="text-xs">{t}</div>
                </div>
              ))}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Paleta de cores</div>
            <div className="flex gap-2">
              {paletteDots.map(c => (
                <span key={c} className="w-7 h-7 rounded-full border-2 border-border/60" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard section */}
      <section className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="glass-card p-6 order-2 lg:order-1">
            <div className="mb-4">
              <h3 className="font-semibold">Dashboard</h3>
              <p className="text-xs text-muted-foreground">Acompanhe suas vendas, métricas e transações</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {dashboardMetrics.map(m => (
                <div key={m.label} className="p-4 rounded-xl border border-border/60 bg-background/40">
                  <div className="text-[11px] text-muted-foreground mb-1">{m.label}</div>
                  <div className="font-bold text-sm mb-1">{m.value}</div>
                  <div className={`text-[10px] ${m.up ? "text-primary" : "text-destructive/80"}`}>{m.trend}</div>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-background/40">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">Vendas em tempo real</div>
                  <div className="font-bold gradient-text">R$ 1.352.692,14 <span className="text-[10px] text-primary">▲ 237,4%</span></div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/>Gerado</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"/>Pago</span>
                </div>
              </div>
              <svg viewBox="0 0 300 100" className="w-full">
                <defs>
                  <linearGradient id="dashFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(200 100% 60%)" stopOpacity="0.55"/>
                    <stop offset="100%" stopColor="hsl(200 100% 60%)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,80 C30,60 55,25 95,30 C135,35 165,10 200,15 C240,20 275,50 300,35 L300,100 L0,100 Z" fill="url(#dashFill)"/>
                <path d="M0,80 C30,60 55,25 95,30 C135,35 165,10 200,15 C240,20 275,50 300,35" fill="none" stroke="hsl(200 100% 60%)" strokeWidth="2"/>
                <path d="M0,90 C40,85 70,75 110,78 C150,82 180,70 220,72 C250,74 275,82 300,78" fill="none" stroke="hsl(38 92% 55%)" strokeWidth="2"/>
              </svg>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">DADOS EM TEMPO REAL</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Um dashboard que mostra <span className="gradient-text">tudo</span> que importa
            </h2>
            <p className="text-muted-foreground mb-8">
              O dashboard unifica suas melhores informações numa visão panorâmica. De vendas a engajamento,
              você acompanha cada oferta em tempo real e decide com dados.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {dashboardHighlights.map(h => {
                const Icon = h.icon;
                return (
                  <div key={h.title} className="glass-card p-5">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{h.title}</h4>
                    <p className="text-xs text-muted-foreground">{h.desc}</p>
                  </div>
                );
              })}
            </div>
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-12 px-7">
              Abrir meu dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* API */}
      <section className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">PIX INTEGRADO À REVANTPAY</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Pagamentos PIX de ponta a ponta</h2>
            <p className="text-muted-foreground mb-6">
              A Riot Vips conecta ao gateway RevantPay para gerar cobranças PIX, receber confirmação por
              webhook assinado e liberar o VIP no mesmo instante. Você só cola a sua chave de API uma vez —
              e todos os seus bots passam a receber pagamento imediatamente.
            </p>
            <ul className="space-y-3 mb-6">
              {[
                "Geração de QR Code e PIX Copia e Cola em tempo real",
                "Webhook assinado (HMAC-SHA256) para confirmar cada venda",
                "Reconciliação automática caso o webhook falhe",
                "Uma única chave de API para todos os seus bots",
              ].map(li => (
                <li key={li} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" /> {li}
                </li>
              ))}
            </ul>
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-12 px-7">
              Conectar minha RevantPay <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-[hsl(220_40%_5%)] shadow-[0_20px_60px_-20px_hsl(200_100%_60%/0.3)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/60">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-destructive/70"/>
                <span className="w-3 h-3 rounded-full bg-amber-400/80"/>
                <span className="w-3 h-3 rounded-full bg-primary/80"/>
                <span className="ml-3 text-xs text-muted-foreground">pix.json</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-primary/15 text-primary">webhook: charge.paid</span>
            </div>
            <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto">
<span className="text-muted-foreground">{`// Webhook recebido pela Riot Vips → VIP liberado`}</span>{`
{
  `}<span className="text-primary">"event"</span>{`: `}<span className="text-primary">"charge.paid"</span>{`,
  `}<span className="text-primary">"charge_id"</span>{`: `}<span className="text-primary">"chg_9f2c1a"</span>{`,
  `}<span className="text-primary">"amount"</span>{`: `}<span className="text-amber-400">2990</span>{`,
  `}<span className="text-primary">"status"</span>{`: `}<span className="text-primary">"paid"</span>{`,
  `}<span className="text-primary">"paid_at"</span>{`: `}<span className="text-primary">"2026-07-28T14:31:02Z"</span>{`,
  `}<span className="text-primary">"signature"</span>{`: `}<span className="text-primary">"hmac-sha256:•••"</span>{`
}

`}<span className="text-muted-foreground">{`// → Riot Vips valida a assinatura e envia`}</span>{`
`}<span className="text-muted-foreground">{`// o link VIP no chat em menos de 3 segundos.`}</span>
            </pre>
          </div>
        </div>
      </section>

      {/* Novidades */}
      <section id="novidades" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">
              <Sparkles className="w-4 h-4" /> NOVIDADES DA PLATAFORMA
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">O que acabou de chegar na Riot Vips</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A plataforma evolui toda semana. Estas são as funções mais recentes já disponíveis na sua conta.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {whatsNew.map(n => {
              const Icon = n.icon;
              return (
                <div key={n.title} className="glass-card-hover p-6 relative">
                  <span className="absolute top-5 right-5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                    {n.tag}
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 border border-primary/25 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{n.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{n.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Toolbox */}
      <section id="tools" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">TUDO QUE VOCÊ PRECISA</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Uma caixa de ferramentas completa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pare de pagar (e integrar) uma ferramenta para cada coisa. Está tudo dentro da Riot Vips,
              conversando entre si.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {toolboxItems.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="glass-card-hover p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">O QUE NOSSOS PRODUTORES DIZEM</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Quem migrou, cresceu</h2>
            <p className="text-muted-foreground">Depoimentos reais de quem já usa a Riot Vips todos os dias.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map(t => (
              <div key={t.name} className="glass-card p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-xs md:text-sm font-semibold tracking-widest text-primary mb-4">TAXAS RIOT VIPS</div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Uma taxa justa, sem letras miúdas</h2>
          <p className="text-muted-foreground mb-10">
            Essas são as nossas taxas — simples, transparentes e das menores do mercado.
          </p>
          <div className="relative glass-card p-10 md:p-14 overflow-hidden">
            <div className="absolute -top-1 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <div className="flex items-baseline justify-center gap-3 mb-2 flex-wrap">
              <span className="text-6xl md:text-7xl font-bold gradient-text">R$ 0,60</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8">fixo por transação aprovada — sem percentual</p>
            <ul className="space-y-3 mb-10 text-left max-w-md mx-auto">
              {[
                "Sem mensalidade obrigatória para começar",
                "Sem taxa escondida — o que você vê é o que você paga",
                "Saque em minutos via PIX RevantPay",
                "Migração assistida e gratuita",
              ].map(li => (
                <li key={li} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" /> {li}
                </li>
              ))}
            </ul>
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-14 px-10 text-base">
              Criar conta grátis <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Perguntas frequentes</h2>
            <p className="text-muted-foreground">Tudo o que você precisa saber antes de começar.</p>
          </div>
          <div className="space-y-3">
            {faqs.map(f => (
              <details key={f.q} className="glass-card p-5 group">
                <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                  <span>{f.q}</span>
                  <ArrowRight className="w-4 h-4 text-primary transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center glass-card p-12 md:p-16 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-primary/25 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-accent/25 rounded-full blur-3xl" />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Pronto para começar?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Crie sua conta gratuitamente e comece a vender no Telegram em minutos.
            </p>
            <Button onClick={() => navigate("/auth")} className="btn-gradient border-0 rounded-full h-14 px-10 text-base">
              Criar conta grátis <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary" /> Setup em minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary" /> Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Riot Vips</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <span>Todos os direitos reservados</span>
        </div>
      </footer>
    </div>
  );
}