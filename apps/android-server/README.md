# Android Server — arquitetura planejada, Fase 11

Nenhum APK ou projeto Android compilável é incluído nesta fase. Objetivo: aplicativo Kotlin com ação explícita “Hospedar servidor”, serviço foreground e notificação permanente enquanto ativo, com botão “Parar”. Não há serviço escondido.

## Runtime

Plano de integração: módulo de simulação JS puro compilado em bundle headless, executado em runtime embutido (QuickJS é candidato a validar), com libwebrtc nativa para DataChannels. A ponte Kotlin/runtime entrega apenas inputs, ticks e snapshots, sem DOM nem engine gráfica.

Isso exige uma prova técnica de manutenção da biblioteca, ABIs ARM64, timers, memória, suporte ao JavaScript compilado e troca eficiente de buffers. Não assumir que Node/Electron roda nativamente no Android, nem que WebView pode substituir um serviço de simulação robusto em segundo plano. Se a prova falhar, trocar runtime/bridge sem mudar protocolo e API dos jogos.

## Serviço e sistema

O Android exige tipo apropriado e permissões para foreground service em versões recentes. Determinar o enquadramento real da hospedagem (incluindo eventual specialUse e seus requisitos) durante a implementação; não escolher dataSync ou connectedDevice apenas para manter o processo vivo. Referência: [tipos de foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types).

Iniciar por ação do usuário com o app visível. Exibir status, partidas/capacidade e jogadores. Respeitar parada manual, encerramento pelo sistema, modo de economia e bloqueios de início em segundo plano. Documentação: [restrições de início de serviços](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start).

Usar wake lock somente se necessário, pelo período ativo e com liberação garantida. Monitorar temperatura/bateria e reduzir admissão antes de causar instabilidade. Wi-Fi recomendado; não prometer 3 partidas em todo telefone.

## Desconexão

Mudança de rede: interromper admissão, reconectar controle com backoff/jitter, renovar lease e negociar ICE restart. Informar falha aos jogadores. Após parada explícita não reiniciar automaticamente; após perda transitória, retomar apenas enquanto a hospedagem continuar ativada e o sistema permitir.

## Aceitação

Testar Android alvo em hardware físico: tela apagada, app em segundo plano, economia de bateria, rede alternando, throttling, bateria baixa, parada pela notificação, kill pelo sistema e recuperação. Só anunciar capacidade após benchmark representativo. Foreground service não garante que o processo nunca será encerrado.
