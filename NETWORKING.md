# Rede, signaling e reconexão

## Topologia

Um host autoritativo para cada partida. Cada jogador abre uma conexão com o host, nunca uma conexão de simulação com todos os outros jogadores. O coordenador transporta mensagens de controle e signaling; não recebe snapshots a cada tick.

O fluxo planejado é: registrar host → localizar/reservar sala → obter ticket → signaling autorizado → ICE → abrir DataChannels → HELLO → consumir ticket no host → WELCOME → inputs/snapshots.

## Signaling (Fases 3 e 4)

Transporte de controle: HTTPS para operações e WebSocket autenticado para mensagens dirigidas ao host e ao jogador. O host faz conexão de saída; nenhum encaminhamento manual de porta é requisito do fluxo comum.

`SignalingChannel` e `SignalEnvelope` estão tipados. Cada envelope tem protocolo, sessionId opaco, generation de ICE restart, sequence e payload offer/answer/ice/ice-complete. O serviço vincula sessionId às identidades autenticadas, sala, host e autorização de entrada. Não aceita destino arbitrário informado pelo cliente.

1. Criar sessão de signaling com ticket válido. Reservar o uso único do ticket para a admissão final; não consumi-lo duas vezes.
2. Host é o único offerer para simplificar colisões de negociação.
3. Encaminhar SDP e Trickle ICE exclusivamente entre os dois participantes autorizados.
4. Enfileirar candidatos até `setRemoteDescription` terminar. Limitar fila e quantidade de candidatos.
5. Descartar mensagens de generation antiga. Validar sequência por sessão e direção.
6. Encerrar sessão após timeout, saída ou host expirado. Rate limit de abertura e mensagens.

Limite planejado: 64 KiB por envelope de signaling, aplicado **antes** de parse. O tipo está implementado; o decoder de signaling, endpoints, limites por conexão e autenticação de WebSocket ainda são requisitos das fases 3/4.

A especificação WebRTC não oferece um serviço de signaling pronto. O projeto precisa fornecê-lo: [guia oficial de peer connections](https://webrtc.org/getting-started/peer-connections).

## DataChannels

| Canal | Configuração | Uso |
|---|---|---|
| realtime | ordered=false, maxRetransmits=0 | inputs de movimento e snapshots recentes |
| reliable | ordered=true, retransmissão padrão | admissão, entrada/saída, ataque, eventos, pontuação, início/fim |

Movimento envia o estado atual dos controles, não apenas “tecla apertada”. Assim, perda de um pacote não deixa o personagem andando indefinidamente. Se faltar input por 250 ms na Arena, o host aplica vetor zero. Ataque é comando confiável com ID único e cooldown validado pelo host; nunca uma ordem para aplicar dano arbitrário.

Em congestionamento, descartar snapshots antigos antes de novos. `Transport.send` pode devolver false para realtime. No reliable, não descartar silenciosamente: erro BACKPRESSURE e recuperação controlada. Verificar `bufferedAmount`, evento de buffer baixo e limite de 64 KiB no adaptador WebRTC. Não retransmitir movimento manualmente.

## ICE, STUN, TURN e privacidade

- LAN é um caminho que o ICE pode selecionar; não precisa ser um protocolo de jogo separado.
- Candidatos host podem produzir comunicação local; candidatos reflexivos permitem conexão direta fora da LAN.
- TURN retransmite bytes criptografados quando a conexão direta falha, sem executar física.
- TURN pode gerar tráfego significativo; provisionar quotas e credenciais temporárias no coordenador. Nenhuma senha permanente no frontend.
- Disponibilidade de TURN, TLS e certificados precisa ser configurada antes de prometer uso pela internet sem ajuste do roteador.

`privacy: direct` permite ICE direto. Um participante com ferramentas de rede pode descobrir o endereço do peer remoto. Esconder IP na UI ou usar código de sala não impede isso.

`privacy: relay-only` deverá configurar ambos os peers com `iceTransportPolicy: "relay"` e impedir fallback silencioso para direto. Isso pode piorar latência e custo. Não dá para prometer simultaneamente IP oculto dos peers e LAN direta. O diretório nunca publica IP em nenhum dos modos. O serviço de sinalização/TURN ainda observa metadados de conexão.

A política de candidatos é documentada em [RTCPeerConnection: configuração](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection).

## Seleção do caminho

Não implementar uma sequência de três timeouts longos “LAN, depois internet, depois TURN”. Permitir ao ICE avaliar os candidatos e usar o par viável; medir RTT/perdas pelo par selecionado. Uma política extra de preferência pode ser adicionada quando medições justificarem.

O caminho escolhido é reportado como lan/direct/relay/unknown. O adaptador não deve inventar classificação quando os dados do navegador não permitem determinar a rota. O usuário pode escolher modo relay-only por privacidade.

## Tempo de simulação

Defaults: 30 ticks/s, 15 snapshots/s e buffer inicial de interpolação de 100 ms. Intervalos de simulação são fixos. Usar acumulador com limite de catch-up; nunca aumentar deslocamento conforme a frequência de mensagens do cliente.

Fase 6: interpolar snapshots pelo relógio do servidor e pelo tick. Em falta de snapshot, extrapolar por intervalo pequeno e parar. Prediction/reconciliation ficam opcionais após medir a sensação de atraso: guardar inputs não confirmados, reaplicar após snapshot com ack e suavizar a correção visual. Não usar posição prevista do cliente como autoridade.

`seq`, `tick`, `ack`, IDs de eventos e snapshots separados já existem no protocolo. O buffer de interpolação e a simulação ainda não estão implementados. ACK por conexão corresponde ao input realmente aplicado pelo host, não apenas ao último recebido.

## Reconexão

O estado de conexão deve aparecer ao jogador. Ao perder o host: parar envio/ataques, congelar ou suavizar a apresentação, mostrar “Reconectando…”. Tentar ICE restart e novo signaling com backoff e jitter, sem ultrapassar o prazo global de 15 s.

Se o host ainda existe, pedir resume usando sessão de convidado e token de retomada. Emitir ticket novo, manter playerId e rotacionar resumeToken. Receber snapshot completo antes de retomar. Nenhuma rotação reinicia indefinidamente o prazo de perda da conexão original.

Se somente o coordenador caiu, uma conexão de partida já estabelecida pode continuar. Não iniciar novas salas enquanto o controle está indisponível. Se o processo do host caiu, encerrar depois do prazo: não há host migration inicial.

A política de prazo e a reserva de vaga estão testadas em memória; o fluxo WebRTC de restart e retomada pertence à Fase 4.

## LAN futura

Web app comum não faz varredura mDNS arbitrária nem abre sockets UDP. Descoberta mDNS será responsabilidade do aplicativo nativo de host/cliente compatível. QR ou código já resolve descoberta com diretório online; a mídia de jogo pode continuar local.

Modo **totalmente offline** exige um coordenador LAN e modo de servir/abrir o cliente local, com contexto seguro compatível com as APIs necessárias. Não confundir “mesma rede, com diretório online” com “sem internet”. Nomes `.local`, HTTPS, certificados, permissões de acesso à rede local e mixed content precisam ser testados nos navegadores-alvo. `LanTransport` não contorna restrições do navegador.

## Matriz de integração pendente

Dois computadores reais; Chrome/Firefox/Edge; Android; LAN com internet; LAN sem internet; CGNAT; TURN forçado; UDP bloqueado; host minimizado; suspensão; mudança Wi-Fi/dados móveis; perda/jitter; 8 jogadores; 3–10 partidas por host. Nenhuma dessas integrações foi validada pela suíte da Fase 1.
