# Estabilização crítica da Riot Vips

## Objetivo
Eliminar as quedas aparentes do dashboard e painel admin e reduzir a pressão que o próprio frontend causa no backend.

## Correções
1. **Sessão e login**
   - Remover o bloqueio da renovação automática do login, que mantém JWT expirado e derruba todas as consultas.
   - Inicializar a sessão com a API oficial, aplicar limite de espera e nunca deixar a tela presa em carregamento infinito.
   - Tratar expiração/indisponibilidade temporária sem apagar uma sessão válida precipitadamente.

2. **Dashboard resiliente**
   - Garantir encerramento do carregamento mesmo quando uma consulta falhar ou demorar.
   - Preservar os últimos dados disponíveis enquanto uma atualização é tentada.
   - Evitar consultas duplicadas e atualizações concorrentes.

3. **Painel admin e carga do banco**
   - Parar de carregar todas as abas e tabelas pesadas ao abrir `/admin`.
   - Carregar primeiro apenas autenticação e visão inicial; buscar dados detalhados sob demanda conforme a aba acessada.
   - Reduzir consultas integrais repetidas e limitar históricos grandes.

4. **Validação operacional**
   - Validar login, dashboard e `/admin` no navegador.
   - Conferir build, erros de runtime e saúde do Lovable Cloud.
   - Se a infraestrutura continuar apresentando timeouts após as correções de código, reiniciar o backend e confirmar a recuperação.

## Resultado esperado
Sessões continuam válidas por renovação automática; falhas momentâneas não deixam a interface eternamente carregando; e a abertura do painel admin deixa de disparar dezenas de consultas pesadas simultaneamente.

## Observação
Disponibilidade absoluta de 100% não pode ser garantida por software, mas estas mudanças removem as causas concretas encontradas e reduzem substancialmente o risco e o impacto de indisponibilidade.
