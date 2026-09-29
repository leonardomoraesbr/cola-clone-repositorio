# Painel admin: datas das vendas corretas e vendedor identificado

## O que está errado hoje

Verificado em `src/pages/AdminPanel.tsx` e nos dados reais de `payment_orders`:

1. **Data exibida é a da confirmação, não a da venda.** A lista "Últimas Vendas (plataforma)" e a lista de compradores mostram `paid_at` quando existe. Nos dados atuais há uma venda criada em 29/07 às 20:57 (Brasília) e confirmada só em 30/07 às 00:38 — ela aparece como 30/07. Como a reconciliação pode demorar, esse deslocamento acontece com frequência em vendas da madrugada.
2. **Ordenação por `paid_at`.** `loadBuyers()` ordena por `paid_at`, então a ordem da lista não corresponde à ordem em que as vendas aconteceram.
3. **Formatação de data espalhada e inconsistente.** Existem dezenas de `new Date(...).toLocaleDateString(...)` escritos à mão pelo arquivo; alguns trechos (CSV de diagnóstico, cards de leads) misturam `paid_at` e `created_at` sem rótulo, então não dá para saber qual data está sendo mostrada. Já existe `src/lib/brtDate.ts` com `formatBrtDate` / `formatBrtDateTime`, mas o painel quase não usa.
4. **Vendas não mostram o vendedor.** As tabelas de vendas e de leads mostram só o @bot. Não há coluna de vendedor, e o admin precisa lembrar de cor a qual usuário cada bot pertence. O mesmo vale para o CSV exportado e para a aba de Diagnóstico de PIX.
5. **"Última venda" do usuário usa `paid_at`.** Na aba Usuários, a coluna "Última venda" também herda o desvio de data.

## O que muda

### 1. Uma única fonte de data
Toda data do painel passa a usar os helpers de Brasília (`formatBrtDate`, `formatBrtDateTime`) em vez de `toLocaleDateString` manual. Regra fixa: **a data comercial da venda é `created_at`** (quando o pedido foi gerado); `paid_at` é sempre mostrado como informação separada, com rótulo próprio.

### 2. Tabela "Últimas Vendas (plataforma)"
- Colunas: Comprador • **Vendedor** • Bot • Valor • **Data da venda** • **Pago em**.
- Ordenação por `created_at` decrescente.
- Quando o pagamento cair em outro dia, a diferença fica visível em vez de sobrescrever a data da venda.

### 3. Coluna Vendedor onde há venda ou lead
Mostra o nome (ou e-mail) do dono do bot, com o @bot abaixo em texto menor. Aplicado em:
- Últimas Vendas (plataforma)
- Lista de Leads / vendas pendentes
- Aba Diagnóstico de PIX (linhas de pedido e timeline)
- Modal de detalhes do usuário (a lista de pedidos passa a mostrar Data da venda e Pago em)

A atribuição segue a regra da plataforma: a venda pertence ao dono do bot que a gerou (`bots.user_id` → `profiles`).

### 4. CSV de exportação
Os arquivos exportados (vendas, leads, diagnóstico de PIX) ganham as colunas `Vendedor`, `Email do vendedor`, `Data da venda` e `Pago em`, todas no fuso de Brasília, para poder ser enviado ao vendedor como comprovação.

### 5. Cards e totais
`Vendas Hoje`, `Vendas no Mês`, `Taxas Hoje`, `Taxas no Mês` continuam usando os limites de dia/mês em Brasília sobre `created_at` — igual à dashboard do usuário — de modo que o número dos cards bate exatamente com as linhas listadas abaixo deles.

### 6. Aba Usuários
A coluna "Última venda" passa a usar a data da venda (`created_at` do pedido pago mais recente) e é formatada pelos helpers de Brasília.

## Detalhes técnicos

- Arquivo principal: `src/pages/AdminPanel.tsx`. Nenhuma migração, nenhuma alteração de dados e nenhuma mudança em edge functions.
- Criar um mapa `sellerByBotId` (bot → `{ userId, name, email, username }`) construído uma vez a partir das consultas de `bots` e `profiles` que o painel já faz; as tabelas consomem esse mapa, sem chamadas extras ao banco.
- `loadBuyers()`: ordenar por `created_at`; `loadLeads()` já está correto.
- Substituir as chamadas manuais de `toLocaleDateString`/`toLocaleTimeString`/`toLocaleString` por `formatBrtDate` e `formatBrtDateTime` de `src/lib/brtDate.ts`.
- Verificação ao final: comparar a venda de 29/07 20:57 BRT (confirmada 30/07 00:38 BRT) na tela — ela deve aparecer listada em 29/07 com "Pago em 30/07", e o card de Vendas do dia 29 deve incluí-la.