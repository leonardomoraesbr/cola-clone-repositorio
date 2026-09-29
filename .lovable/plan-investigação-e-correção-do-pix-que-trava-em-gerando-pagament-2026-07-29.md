# Investigação e correção do PIX que trava em "Gerando pagamento..."

## O que confirmei nos dados

- Nas últimas 48h todas as `payment_orders` foram criadas com `pix_code` e `pix_qrcode_url` preenchidos (91/91 nos últimos 7 dias). Ou seja, a RevantPay está respondendo o PIX e o registro do pedido conclui no banco.
- Logo, o problema **não é a geração do PIX**, e sim a **entrega das mensagens no Telegram** após o "⏳ Gerando pagamento PIX...".

## Diagnóstico (não confirmado, precisa de log)

Três causas plausíveis, todas compatíveis com "só aparece Gerando pagamento":

1. **Timeout do webhook do Telegram (~60s).** Hoje `telegram-webhook` só responde 200 depois de: chamar RevantPay + inserir order + `sendPhoto` (upload multipart do QR em base64) + 2 `sendMessage`. Se qualquer passo demora, o Telegram desiste, reenvia o update e o segundo processamento é descartado — o lead nunca vê o QR/código.
2. **`sendPhoto` falha silenciosa.** O QR chega como `data:image/png;base64,...` (~1.7KB) e é enviado por multipart. Se o Telegram rejeita (caption Markdown mal formada com nome de plano contendo `_`, `*`, `[`, ou blob inválido), o `try/catch` engole o erro sem log detalhado, mas ainda tenta enviar o `pix_code`. Se essa segunda chamada também falhar (mesmo motivo), o lead fica sem nada.
3. **`fetch` sem timeout na RevantPay/Telegram.** Se a conexão trava, o handler nunca termina e cai no caso 1.

Sem os logs da função `telegram-webhook` não dá para afirmar qual dos três está afetando quem, então a primeira etapa do plano é **instrumentar** e as demais são **blindagens** que corrigem os três cenários de uma vez.

## O que vou mudar

### 1. Instrumentar `generatePayment` em `supabase/functions/telegram-webhook/index.ts`
- Log estruturado por etapa: `[PIX] revantpay_ok`, `[PIX] order_inserted`, `[PIX] sendPhoto_status=xxx`, `[PIX] sendMessage_pix_status=xxx`, com `order_id`, `chat_id`, `telegram_user_id`.
- Registrar o corpo de resposta do Telegram quando `ok=false` (hoje é ignorado).

### 2. Sempre entregar o código PIX, mesmo se o QR falhar
- Antes de tentar `sendPhoto`, mandar imediatamente uma mensagem **em texto puro** (sem Markdown) com valor, plano e o `pix_code` copia-e-cola. Isso garante que o lead sempre tem como pagar.
- Depois, tentar o `sendPhoto` como enriquecimento; se falhar, tentar `sendPhoto` **por URL** (link direto do PNG) como fallback antes de desistir.
- Escapar o nome do plano na caption Markdown (`_`, `*`, `[`, `]`, `` ` ``) para evitar 400 "can't parse entities".

### 3. Não bloquear a resposta ao Telegram
- No handler do callback `pay_*`, responder 200 imediatamente e rodar `generatePayment` com `EdgeRuntime.waitUntil(...)`. Isso elimina o timeout do webhook e evita reentregas duplicadas.

### 4. Timeouts explícitos nos `fetch`
- `AbortController` com 20s no `POST /charges/pix` da RevantPay e 15s em cada chamada de `sendMessage`/`sendPhoto`. Se estourar, cai no fallback texto e loga.

### 5. Deduplicação leve
- Chave curta em memória por `update_id` do Telegram para descartar reentrega enquanto o `waitUntil` ainda roda (barato, resolve o caso em que o Telegram já reentregou antes do item 3 entrar em vigor).

## Como valido

- Deploy do `telegram-webhook`, rodar um `/start` real em um bot de teste, checar `edge-function-logs` mostrando a sequência `[PIX] ...` completa.
- Consultar `payment_orders` das últimas horas e conferir que nenhuma ficou órfã (sem interação subsequente do lead).
- Pedir ao usuário para confirmar com um lead real que agora sempre chega o código PIX (com ou sem QR).

## Arquivos tocados

- `supabase/functions/telegram-webhook/index.ts` (única alteração de código)

Nenhuma mudança no front-end, no schema do banco ou em outras funções.
