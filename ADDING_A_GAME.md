# Adicionar um jogo

## Layout de um módulo

Começar com `games/<id>/src/index.ts`, manifesto e validação. Ao implementar, separar:

- `manifest.ts`: nome, versão, ícone, engine, limites e mapas.
- `rules.ts`: valores configuráveis específicos do jogo.
- `input.ts`: esquema e interpretação de intenção.
- `simulation/`: estado, movimento, colisões, dano e vitória, sem DOM.
- `snapshot.ts`: formato compacto e versionado de estado.
- `client/`: apresentação e integração com a API interna; ou um pacote de renderer separado para manter dependências visuais fora do build do host.

`GameModule<I,S,E,C>` define validateInput, validateCommand e createRuntime. `GameRuntime` define inclusão/remoção de jogadores, acceptInput para movimento, acceptCommand para ações confiáveis, step, snapshot e dispose. Regras não devem depender do ciclo de renderização.

## Manifesto

A Arena existente define: arena-2d, versão 0.1.0, renderer phaser, protocolo 1, 2–8 jogadores, mapa first-ring e status development. Um jogo só vira playable depois de cumprir testes e funcionar pela rede real.

O limite global do host é um teto, não uma permissão para ignorar min/max de cada manifesto. A referência atual trabalha com o único perfil de Arena; a integração com catálogo/worker deverá validar maxPlayers, versão do mapa e limites por módulo antes de confirmar alocação.

## Passos

1. Criar pacote ESM com TypeScript estrito, exportando manifesto e código headless.
2. Adicionar referências de build e fronteiras em `scripts/check-boundaries.mjs`.
3. Implementar GameRuntime com tempo/tick e random injetados. Evitar Date.now, Math.random e APIs de browser na simulação.
4. Definir input pequeno e validar valores em runtime. Descartar posição, velocidade ou dano arbitrários enviados pelo cliente.
5. Autorizar cada comando: distância, vida, cooldown, partida em andamento e limites físicos.
6. Definir snapshot pequeno, identidade dos slots, ACK por jogador e eventos confiáveis com IDs.
7. Implementar renderer usando snapshots e MatchConnection; nunca conectar direto a um backend.
8. Testar localmente, depois com duas conexões reais e finalmente oito jogadores e múltiplas partidas.
9. Medir custo por partida e publicar perfil de capacidade dessa versão.
10. Atualizar catálogo, documentos e testes de compatibilidade.

## Arena: decisões iniciais

Visão top-down, arena 960×640, raio 18, velocidade 180 unidades/s, HP 100, dano 25, alcance 60, cooldown 500 ms, respawn 3 s e rodada 180 s. Valores estão em `arenaRules`. São propostas de balanceamento, não gameplay já executável.

Movimento normaliza diagonais. `validateArenaInput` só aceita `{move: [x, y]}` com componentes entre -1 e 1. O comando attack tem payload null; o host calcula alvo e dano. ready e rematch também são intenções; a simulação decide quando aceitá-las.

No PC: WASD/setas e ataque; mobile: joystick virtual e botão de ataque. Pausa/foco perdido envia intenção zero e o host também tem timeout para input ausente.

Snapshot planejado por jogador: `[slot,x,y,hp,score,respawnTick]`, com posições quantizadas. Nome/país e identidade do slot chegam por evento confiável. Se um snapshot citar slot ainda desconhecido, o cliente espera o cadastro; não assume ordem entre canais.

A engine Phaser não determina HP, placar ou colisões autoritativas. Círculos provisórios e mapas simples são próprios; não importar personagens, mapas, sons ou código de jogos comerciais.

## 3D

Babylon.js cuida da apresentação. Uma física 3D headless futura terá orçamento e dependências próprios, compartilhando regras/formatos onde fizer sentido. Não exigir determinismo bit a bit do cliente: o host continua a fonte de verdade, com snapshots e correção.

Kart, Football e Party permanecem no roadmap. Não criar quatro engines incompletas antes de comprovar a Arena.
