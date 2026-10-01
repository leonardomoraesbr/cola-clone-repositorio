import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Mail, Lock, User, Eye, EyeOff, Phone, Zap, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra")
  .regex(/[0-9]/, "A senha deve conter ao menos um número");

/** Traduz os erros do provedor de autenticação para português. */
function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function traduzErroAuth(message: string) {
  const m = (message || "").toLowerCase();
  if (m.includes("error sending confirmation email") || m.includes("error sending recovery email")) {
    return "O serviço de e-mail do Supabase não conseguiu enviar a mensagem. O administrador precisa verificar o SMTP e os limites de envio.";
  }
  if (m.includes("weak") || m.includes("easy to guess") || m.includes("pwned")) {
    return "Essa senha é muito comum e apareceu em vazamentos públicos. Crie uma senha única (misture letras, números e símbolos) — evite datas, nomes e sequências.";
  }
  if (m.includes("password should be at least")) return "A senha é curta demais. Use no mínimo 8 caracteres.";
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos";
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (m.includes("unable to validate email")) return "Email inválido. Confira o endereço digitado.";
  return message;
}
const phoneSchema = z.string().min(10, "Telefone inválido").max(20);

const COUNTRIES = [
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colômbia" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "México" },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguai" },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguai" },
  { code: "PE", dial: "+51", flag: "🇵🇪", name: "Peru" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "Espanha" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "Reino Unido" },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showCountry, setShowCountry] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; phone?: string; confirmPassword?: string }>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const isNew = localStorage.getItem("riot_new_signup") === "1";
      if (isNew) {
        localStorage.removeItem("riot_new_signup");
        navigate("/configuracoes-iniciais");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  const validate = () => {
    const newErrors: typeof errors = {};

    try {
      emailSchema.parse(email);
    } catch (e: any) {
      newErrors.email = e.errors[0].message;
    }

    try {
      passwordSchema.parse(password);
    } catch (e: any) {
      newErrors.password = e.errors[0].message;
    }

    if (!isLogin && !fullName.trim()) {
      newErrors.fullName = "Nome é obrigatório";
    }

    if (!isLogin) {
      try {
        phoneSchema.parse(phone.replace(/\D/g, ""));
      } catch (e: any) {
        newErrors.phone = e.errors[0].message;
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "As senhas não coincidem";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Erro ao entrar",
          description: traduzErroAuth(error.message),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bem-vindo de volta!",
          description: "Login realizado com sucesso.",
        });
      }
    } else {
      const fullPhone = `${country.dial} ${phone}`.trim();
      const { error } = await signUp(email, password, fullName, fullPhone);
      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Email já cadastrado",
            description: "Esse email já está em uso. Tente fazer login.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: traduzErroAuth(error.message),
            variant: "destructive",
          });
        }
      } else {
        localStorage.setItem("riot_new_signup", "1");
        toast({
          title: "Conta criada!",
          description: "Vamos finalizar suas configurações iniciais.",
        });
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Left Promo */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-border/40">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)/0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Riot Vips</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Plataforma de pagamentos
          </div>
          <h2 className="text-5xl font-bold leading-tight">
            {isLogin ? (
              <>Bem-vindo de <span className="gradient-text">volta.</span></>
            ) : (
              <>Crie sua conta e inicie suas <span className="gradient-text">vendas em minutos.</span></>
            )}
          </h2>
          <p className="text-muted-foreground text-lg max-w-md">
            Cadastro rápido e sem burocracia — em poucos passos você já está pronto para vender e receber via PIX.
          </p>

          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Receba via</p>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border/60">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold leading-tight">Receba via PIX instantâneo</p>
                <p className="text-xs text-muted-foreground">Taxa fixa de apenas R$ 0,60 por venda aprovada</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Riot Vips. Todos os direitos reservados.
        </div>
      </div>

      {/* Right Form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Link>

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Riot Vips</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isLogin ? "Acesse seu painel e continue vendendo." : "Preencha seus dados e comece a vender."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full input-dark pl-12"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu e-mail"
                  className="w-full input-dark pl-12"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2">Telefone / WhatsApp</label>
                <div className="relative flex gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountry((v) => !v)}
                      className="h-full flex items-center gap-1.5 px-3 rounded-lg bg-secondary/50 border border-border/50 text-sm hover:bg-secondary transition-colors"
                    >
                      <span className="text-base">{country.flag}</span>
                      <span className="font-medium">{country.dial}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {showCountry && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowCountry(false)}
                        />
                        <div className="absolute z-50 top-full mt-2 left-0 w-64 max-h-72 overflow-y-auto rounded-lg bg-popover border border-border shadow-lg py-1">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c);
                                setShowCountry(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                            >
                              <span className="text-base">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-muted-foreground">{c.dial}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full input-dark pl-12"
                    />
                  </div>
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? "Digite sua senha" : "Crie uma senha"}
                  className="w-full input-dark pl-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
              {!isLogin && (
                <div className="mt-2 space-y-1.5">
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        passwordScore(password) >= 4 ? "bg-emerald-500" : passwordScore(password) >= 3 ? "bg-amber-500" : "bg-destructive"
                      }`}
                      style={{ width: `${(passwordScore(password) / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use 8+ caracteres com letras, números e símbolos. Senhas comuns (ex.: 12345678, senha123) são bloqueadas por segurança.
                  </p>
                </div>
              )}
            </div>

            {isLogin && (
              <p className="-mt-2 text-sm text-muted-foreground">
                A recuperação de senha está temporariamente indisponível. Se esqueceu sua senha, entre em contato com o suporte.
              </p>
            )}

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full input-dark pl-12"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gradient border-0 h-12 text-base"
            >
              {isLoading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Criar conta" : "Faça login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
