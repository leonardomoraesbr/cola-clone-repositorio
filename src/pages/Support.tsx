import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MessageCircle, Instagram, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

export default function Support() {
  const [links, setLinks] = useState({ instagram: "", telegram: "", discord: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const keys = ["support_instagram", "support_telegram", "support_discord"];
      const { data } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", keys);

      const map: Record<string, string> = {};
      data?.forEach(d => { map[d.key] = d.value; });
      setLinks({
        instagram: map.support_instagram || "",
        telegram: map.support_telegram || "",
        discord: map.support_discord || "",
      });
      setLoading(false);
    }
    load();
  }, []);

  const channels = [
    {
      name: "Instagram",
      icon: Instagram,
      url: links.instagram,
      color: "from-pink-500 to-purple-500",
      desc: "Siga-nos no Instagram para novidades e dicas",
    },
    {
      name: "Telegram",
      icon: MessageCircle,
      url: links.telegram,
      color: "from-blue-400 to-blue-600",
      desc: "Entre no nosso grupo do Telegram para suporte rápido",
    },
    {
      name: "Discord",
      icon: DiscordIcon,
      url: links.discord,
      color: "from-indigo-500 to-purple-600",
      desc: "Junte-se à comunidade no Discord",
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Suporte Riot Vips</h1>
          <p className="text-muted-foreground">
            Precisa de ajuda? Entre em contato conosco por qualquer um dos canais abaixo.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((ch) => {
              const Icon = ch.icon;
              const hasUrl = !!ch.url;
              return (
                <a
                  key={ch.name}
                  href={hasUrl ? ch.url : "#"}
                  target={hasUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`glass-card p-6 flex items-center gap-5 transition-all animate-fade-in ${
                    hasUrl ? "hover:border-primary/30 cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={(e) => !hasUrl && e.preventDefault()}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${ch.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{ch.name}</h3>
                    <p className="text-sm text-muted-foreground">{ch.desc}</p>
                    {!hasUrl && (
                      <p className="text-xs text-muted-foreground mt-1 italic">Link não configurado</p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
