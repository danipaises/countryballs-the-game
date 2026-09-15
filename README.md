# CountryBalls Games — Fase 1

Base modular para uma plataforma de jogos CountryBalls multiplayer com servidores comunitários autoritativos.

**Versão 0.1.0 · protocolo 1 · Arena 0.1.0 · entrega: arquitetura e núcleo de contratos.**

## O que funciona nesta entrega

- Monorepo npm Workspaces, TypeScript estrito, build com referências entre projetos.
- Interfaces de backend, hospedagem de partidas, transporte, signaling e módulos de jogo.
- Provider comunitário conectado a um coordenador de referência **em memória**.
- Registro e expiração de hosts, heartbeat, sessões de convidados, salas, reservas, convites, admissão e reconexão nos contratos.
- Codec JSON com limites, validação em runtime, separação de canais, proteção contra replay e flood por participante.
- Políticas puras de capacidade e seleção de hosts; manifesto, regras e validação de input da Arena.
- Testes automatizados, demonstração de contratos e simulador de carga sintética.

**Ainda não existe site jogável, servidor de rede, WebRTC operacional, executável Windows, APK, física da Arena ou implantação pública.** Os módulos em memória servem para verificar as invariantes que as próximas fases deverão preservar. Não são um backend público seguro nem fingem conectar dispositivos.

## Executar no Windows, Linux ou macOS

Instale Node.js 24 e extraia o projeto. No terminal, dentro desta pasta:

```sh
npm ci
npm run verify
npm run demo:contracts
npm run load:contracts -- 3 4 10
```

Não é necessário Docker, WSL ou virtualização. Os comandos são os mesmos no PowerShell. Node.js é uma dependência de desenvolvimento desta fase; o aplicativo Windows futuro deverá empacotar o runtime para o usuário final.

O último comando cria 3 hosts lógicos, 4 salas por host e 8 bots por sala, processando 10 segundos de inputs virtuais. **Não mede WebRTC, upload, latência real ou capacidade de hospedagem.** Não use o resultado para anunciar vagas.

| Comando | Resultado |
|---|---|
| `npm run build` | Compila os 11 módulos e gera declarações de tipos |
| `npm run verify` | Executa testes e verifica fronteiras de dependências |
| `npm run demo:contracts` | Dois convidados, sala privada, admissão, início, fim e retorno ao lobby |
| `npm run load:contracts -- 3 4 10` | Carga sintética sobre codec, validação e contratos |

`package-lock.json` fixa a instalação. Não há dependências externas em runtime nesta fase. O TypeScript é uma dependência de desenvolvimento.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md): decisões, estrutura, interfaces, riscos e escopo.
- [NETWORKING.md](NETWORKING.md): ICE, signaling, LAN, reconexão e privacidade.
- [COMMUNITY_SERVER.md](COMMUNITY_SERVER.md): Windows, benchmark, reservas e operação.
- [ADDING_A_GAME.md](ADDING_A_GAME.md): contrato de um módulo de jogo.
- [BACKEND_PROVIDERS.md](BACKEND_PROVIDERS.md): substituição de infraestrutura sem alterar jogos.
- [PROTOCOL.md](PROTOCOL.md): mensagens e limites efetivamente implementados.
- [ROADMAP.md](ROADMAP.md): fases, dependências e critérios de aceitação.
- [SECURITY.md](SECURITY.md): fronteiras de confiança e requisitos antes da internet pública.
- [VALIDATION.md](VALIDATION.md): resultados executados e testes pendentes.
- [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md): divisão Pages/Worker, domínios, secrets e ordem de publicação.

## Continuação com agentes de IA

Leia `AGENTS.md`, arquitetura e roadmap antes de editar. O próximo trabalho é a **Fase 2: runtime mínimo do CountryBalls Server**, mantendo os contratos aprovados por testes. Não declare WebRTC, benchmark automático ou multiplayer concluídos usando a demonstração em memória como evidência.

Nenhum código, mapa ou asset de franquias comerciais é incluído. A Arena terá círculos e elementos visuais próprios. Nenhuma licença de redistribuição foi escolhida em nome do proprietário; definir isso antes de uma publicação de código aberto.
