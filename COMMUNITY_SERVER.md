# CountryBalls Server

## Aplicativo independente

O usuário final deverá abrir um aplicativo, testar capacidade, escolher nome/região/reserva e tocar “Iniciar servidor”. Desktop previsto: Electron com runtime Node incorporado; desenvolvimento do núcleo em Node.js sem Docker, WSL, Hyper-V ou máquinas virtuais.

O executável `CountryBallsServer.exe` é objetivo futuro, não arquivo incluído nesta entrega. Inicialmente a Fase 2 criará supervisão e CLI de desenvolvimento; empacotamento e UI virão sobre o mesmo núcleo.

## Processos Windows planejados

- Processo principal: ciclo de vida, bandeja, configuração local, credenciais do host e logs redigidos.
- Workers ou processos de simulação: GameRuntime puro, um por partida ou pool medido. Um travamento de jogo não deve travar o painel.
- Processo de networking: WebRTC do Chromium incorporado, ligado à simulação por mensagens restritas. Sem física dependente de renderização.
- Renderer do painel: UI local, sandbox e contextIsolation; nodeIntegration desligado. Nenhum conteúdo web remoto recebe acesso ao host.

Esta é uma escolha inicial para evitar depender de um binding WebRTC de Node não validado. A Fase 4 precisa medir latência do IPC, RTC sem janela visível, timers e estabilidade ao minimizar. Se o processo de networking não cumprir o orçamento, um adaptador nativo pode substituí-lo sem alterar GameRuntime. Não assumir que flags de background tornam o PC imune à suspensão do sistema.

## Inicialização

1. Carregar configurações e versões dos jogos instalados.
2. Executar benchmark local por jogo e teste de rede contra serviço controlado.
3. Mostrar medições e recomendação; upload desconhecido não recebe “adequado”.
4. Usuário define reserva privada dentro da capacidade recomendada.
5. Registrar host e abrir canal de controle de saída.
6. Receber lease e iniciar heartbeat a cada 5 s.
7. Aceitar alocações idempotentes, criar workers e confirmar prontidão.
8. Ao parar, não aceitar novas salas, avisar jogadores, drenar por prazo e cancelar registro.

## Benchmark

`recommendCapacity()` é uma política pura já implementada; **não é um benchmark executado no hardware**.

O coletor da Fase 2/12 deverá medir:

- Carga de 8 jogadores por partida com inputs, colisões, ataques e serialização representativos.
- P95 do tempo por tick, fração de ticks acima de 33,3 ms, memória incremental e margem do sistema.
- Upload sustentado, RTT, jitter e perdas com endpoint externo; não inferir upload a partir do download contratado.
- Variação durante pelo menos 30 s, seguida de teste prolongado para calibrar térmica e estabilidade.
- Perfil diferente para cada jogo/versão. Dez Arenas não equivalem a dez Karts 3D.

A política atual aplica margem de 30%, reserva 512 MB de memória e limita o resultado a 10 partidas. O menor limite entre CPU, RAM e upload vence. Perda acima de 2%, RTT P95 acima de 200 ms, ticks instáveis, teste curto ou throttling bloqueiam a recomendação pública. Esses são valores iniciais conservadores, não garantias universais.

Meta: mínimo de 3 partidas para anúncio público saudável; máximo padrão 10. Dispositivo que suporta 1 ou 2 pode hospedar privado, e dispositivo incapaz pode receber zero. Nunca elevar a recomendação só para atingir três. Não manter partidas existentes sacrificando o aparelho: primeiro parar admissão, depois drenar se necessário.

## Reserva

Total 5, reserva do dono 1: convidados podem ocupar até 4 vagas; o dono mantém espaço para sua sala. Qualquer sala privada ocupa capacidade física.

Criar sala privada com token de convidado não concede o slot reservado do dono. A referência só autoriza esse uso via sessão do próprio host. Um fluxo futuro de “usar minha reserva pelo celular” precisará de delegação temporária e escopada; não compartilhar o token administrativo.

## Heartbeat e painel

Payload tipado: sequence, uptimeMs, load, stability, networkStatus, acceptingMatches, currentMatches e currentPlayers. HostId/versão vêm da sessão registrada e são associados pelo coordenador, em vez de confiar num ID de outro host dentro da mensagem.

Período 5 s, expiração após 3 intervalos sem recebimento. Sequências repetidas não renovam lease. Heartbeat não pode diminuir artificialmente a contagem de reservas controlada pelo coordenador. Em produção, divergências devem provocar reconciliação/alarme, sem permitir overbooking.

Painel deverá mostrar uptime, CPU, RAM, salas ativas/capacidade, jogadores admitidos, bytes enviados/recebidos, P95 de tick, erros, versão e estado da rede. `HostTelemetry` já define esses campos; nenhum painel foi implementado.

Logs estruturados: evento, gravidade, horário, versão, duração e IDs operacionais temporários quando necessários. Não registrar SDP/ICE, IP, token, convite completo, e-mail ou conteúdo pessoal. Rotação local e retenção curta; exportar diagnóstico com redação.

## Android

Ver [apps/android-server/README.md](apps/android-server/README.md). Uma PWA não é suficiente para prometer hospedagem contínua em segundo plano. O app nativo terá serviço foreground explícito e ação de parar. O serviço não deverá ser escondido nem reiniciado após parada explícita do usuário.

## Limites da Fase 1

Não há servidor ouvindo porta, canal de registro real, benchmark coletor, worker de partida, empacotamento ou assinatura de binário. `demo:contracts` testa o domínio em memória. A próxima etapa reutiliza esse domínio, com handlers de rede validados antes de qualquer exposição externa.
