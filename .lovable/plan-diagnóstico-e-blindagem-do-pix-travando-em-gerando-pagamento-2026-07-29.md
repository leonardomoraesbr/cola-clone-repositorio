# Diagnóstico e blindagem do PIX travando em “Gerando pagamento”

## O que já foi confirmado

- Nos últimos 48h existem **50 pedidos** de pagamento registrados.
- **50/50 pedidos** têm `pix_code` preenchido.
- **50/50 pedidos** têm QR Code preenchido.
- Nos últimos 7 dias, a taxa de criação do PIX por hora aparece como **100%** nas consultas feitas.
- Por bot, nos últimos 7 dias, todos os pedidos consultados também têm PIX criado:
  - `Deboratrans_bot`: 67 pedidos, 67 com PIX.
  - `famosinhassvipsbot`: 22 pedidos, 22 com PIX.
  - Outros bots consultados também aparecem com PIX preenchido.
- Nos logs recentes do `telegram-webhook`, os casos rastreados mostram:
  - RevantPay respondeu com cobrança e PIX.
  - Pedido foi inserido no banco.
  - Mensagem com código PIX foi enviada com sucesso.
  - QR Code foi enviado com sucesso.
- Não encontrei, nos logs recentes pesquisados, erro de RevantPay, erro ao criar pedido ou erro explícito de envio do código PIX.

## Diagnóstico atual

Com os dados atuais, **não há evidência de falha na geração do PIX em si**. A RevantPay está criando a cobrança e a Riot Vips está salvando `pix_code` e QR Code corretamente.

O print do lead (“fica só gerando e n aparece nada”) é compatível com uma falha intermitente na etapa de **entrega no Telegram**, não na criação do pagamento. Essa falha pode acontecer quando:

1. O Telegram demora ou falha ao entregar as mensagens seguintes ao “Gerando pagamento PIX...”.
2. O webhook responde antes do processamento em segundo plano completar, mas o envio posterior não fica rastreável o suficiente para provar o que aconteceu com aquele lead específico.
3. O lead clicou várias vezes, recusou/aceitou order bump, ou recebeu mensagens fora da ordem e a conversa ficou confusa.
4. Mídia do order bump ou caption com texto especial causou erro antes da tela do pagamento em versões anteriores do fluxo.

## Ponto importante sobre o print enviado

O print mostra um fluxo com order bump antes do PIX. Nos logs recentes existe um caso muito parecido em `Deboratrans_bot`, com plano `🔥 VIP 15 Dias`, order bump ativo e clique em `orderbump_no`. Para esse caso recente, o backend registrou sucesso no envio do código PIX e do QR.

Isso indica que **o fluxo já está passando corretamente nos casos registrados agora**, mas ainda falta criar rastreio persistente por etapa para diagnosticar reclamações futuras com precisão absoluta.

## O que ainda está frágil

Hoje os logs ajudam, mas não deixam um histórico estruturado dentro do banco para responder perguntas como:

- Qual lead clicou em qual botão?
- O PIX foi criado?
- O código foi enviado?
- O QR foi enviado?
- O Telegram respondeu erro?
- O lead pagou depois?
- O pedido ficou pendente porque não pagou ou porque não recebeu o código?

Sem essa trilha por pedido/lead, o diagnóstico fica dependente de logs temporários.

## Plano de correção e monitoramento

### 1. Criar rastreio persistente do fluxo PIX

Adicionar uma tabela de auditoria para eventos do pagamento no Telegram, registrando etapas como:

- `payment_started`
- `revantpay_success`
- `order_created`
- `pix_text_sent`
- `pix_qr_sent`
- `payment_instructions_sent`
- `telegram_send_failed`
- `revantpay_failed`
- `order_insert_failed`

Cada evento deve guardar:

- Bot
- Lead do Telegram
- Pedido
- Plano
- Tipo de origem: direto, order bump, downsell, upsell, mailing
- Status da chamada ao Telegram/RevantPay
- Mensagem de erro resumida, quando existir

### 2. Melhorar a mensagem de “Gerando pagamento”

Trocar o texto simples por uma mensagem com fallback operacional:

- Informar que o PIX está sendo gerado.
- Se demorar, orientar o lead a clicar novamente no plano ou chamar suporte.
- Evitar que o lead fique sem direção caso o Telegram atrase a entrega.

### 3. Editar a mensagem “Gerando pagamento” quando o PIX estiver pronto

Quando possível, em vez de deixar o balão antigo parado, atualizar ou complementar com status claro:

- “PIX gerado com sucesso.”
- Em seguida enviar o código copia-e-cola e QR.

Isso reduz a percepção de travamento mesmo quando o Telegram entrega mensagens com atraso.

### 4. Adicionar fallback final se o envio do PIX falhar

Se o envio do código ou QR falhar:

- Tentar reenviar o código como texto puro.
- Se ainda falhar, registrar evento `telegram_send_failed`.
- Enviar uma mensagem curta de erro com orientação para tentar novamente ou acionar suporte.

### 5. Criar visão administrativa de pedidos com problema

No `/admin`, adicionar uma área simples para consultar pedidos recentes com:

- Gerou PIX: sim/não
- Enviou código: sim/não
- Enviou QR: sim/não
- Pago: sim/não
- Último erro detectado
- Bot e lead

Isso permitirá responder vendedores com dados concretos.

### 6. Validar especificamente order bump

Revisar o fluxo:

```text
Lead clica no plano
→ aparece order bump
→ lead clica Sim ou Não
→ cria cobrança PIX
→ envia código copia-e-cola
→ envia QR
→ pagamento aprovado
→ libera acesso
```

Garantir que tanto `Sim` quanto `Não` sempre chamem o mesmo fluxo robusto de pagamento.

## Como validar depois da implementação

- Fazer teste real em um bot com order bump:
  - Clicar em “Sim”.
  - Confirmar código PIX e QR.
  - Clicar em “Não”.
  - Confirmar código PIX e QR.
- Consultar a auditoria e confirmar que cada etapa ficou registrada.
- Comparar pedidos pendentes recentes:
  - Se têm PIX e eventos `pix_text_sent`/`pix_qr_sent`, o lead recebeu o pagamento e apenas não pagou.
  - Se têm PIX mas não têm evento de envio, houve falha real de entrega no Telegram.
  - Se não têm PIX, houve falha real de gateway.

## Resposta recomendada para o vendedor agora

A análise inicial indica que a geração do PIX está funcionando: os pedidos recentes aparecem com código PIX e QR Code gerados. O ponto que pode ter afetado alguns leads é a entrega das mensagens no Telegram após o aviso “Gerando pagamento PIX...”, principalmente em fluxos com order bump.

Vamos aplicar uma blindagem com rastreio por etapa e fallback de reenvio, para garantir que o lead sempre receba pelo menos o código PIX copia-e-cola e para termos diagnóstico exato caso algum envio falhe novamente.
