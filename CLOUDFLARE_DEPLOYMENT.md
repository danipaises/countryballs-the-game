# Implantação no Cloudflare

## O que será hospedado

O CountryBalls Games será dividido em três partes. Cloudflare Pages hospeda o site/PWA. Um Worker com Durable Objects hospeda o diretório, matchmaking leve e signaling. O CountryBalls Server continua nos computadores e celulares comunitários e se conecta ao coordenador por HTTPS/WSS de saída.

Cloudflare não executa a física das partidas comunitárias nesta arquitetura.

| Parte | Destino | Domínio sugerido |
|---|---|---|
| Site/PWA | Cloudflare Pages | `jogos.danipaises.com.br` |
| API e signaling | Cloudflare Worker + Durable Objects | `api-jogos.danipaises.com.br` |
| Partidas | CountryBalls Server do usuário | sem IP publicado |
| STUN | Cloudflare STUN | configurado no WebRTC |
| TURN fallback | Cloudflare Realtime TURN | credenciais temporárias emitidas pelo Worker |

## Estado atual

A Fase 1 contém contratos, protocolo, testes e documentação. Ela não contém `apps/web` compilável nem o Worker de rede. Portanto, ainda não existe uma aplicação útil para publicar. Tentar conectar o repositório inteiro ao Pages agora produzirá erro de build ou um site vazio.

Os arquivos de implantação devem entrar nas fases correspondentes:

1. Fase 3: `apps/coordinator/src/index.ts` e `apps/coordinator/wrangler.jsonc`.
2. Fases 5/6: `apps/web` com React, Vite e Arena.
3. Fase 4: signaling WebSocket, STUN e TURN.

## Estrutura de produção planejada

```text
apps/
  web/
    src/
    public/
    vite.config.ts
    package.json
  coordinator/
    src/index.ts
    src/directory-object.ts
    src/signaling-object.ts
    wrangler.jsonc
    package.json
```

O Worker público valida cada requisição e chama Durable Objects por binding. Os Durable Objects não ficam acessíveis diretamente pela internet.

## Configuração futura do Worker

Exemplo de `apps/coordinator/wrangler.jsonc` para a implementação da Fase 3:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "countryballs-coordinator",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-15",
  "durable_objects": {
    "bindings": [
      {
        "name": "DIRECTORY",
        "class_name": "DirectoryObject"
      },
      {
        "name": "SIGNALING",
        "class_name": "SignalingObject"
      }
    ]
  },
  "exports": {
    "DirectoryObject": {
      "type": "durable-object",
      "storage": "sqlite"
    },
    "SignalingObject": {
      "type": "durable-object",
      "storage": "sqlite"
    }
  },
  "vars": {
    "ALLOWED_ORIGIN": "https://jogos.danipaises.com.br",
    "PROTOCOL_VERSION": "1"
  }
}
```

Isso é um modelo de configuração. As classes ainda precisam implementar os contratos e testes do projeto antes do primeiro deploy.

## Publicar pelo GitHub

Quando `apps/web` e `apps/coordinator` existirem:

1. Enviar o monorepo a um repositório GitHub.
2. No Cloudflare, abrir **Workers & Pages → Create application → Pages → Connect to Git**.
3. Selecionar o repositório.
4. Configurar o projeto web:
   - Root directory: `/`
   - Build command: `npm ci && npm run build:web`
   - Build output directory: `apps/web/dist`
   - Production branch: `main`
5. Publicar o coordenador por CI ou no computador com `npm ci` e `npm run deploy:coordinator`.
6. No projeto Pages, adicionar `jogos.danipaises.com.br` em **Custom domains**.
7. No Worker, adicionar a rota/domínio `api-jogos.danipaises.com.br`.
8. Definir `VITE_COORDINATOR_URL=https://api-jogos.danipaises.com.br` no build do site.

Esses scripts serão adicionados quando os aplicativos correspondentes forem implementados. Não criar comandos que aparentem publicar componentes ausentes.

## Publicar pelo Windows sem Docker

Com Node.js instalado e após a implementação das fases necessárias:

```powershell
npm ci
npm run verify
npx wrangler login
npm run deploy:coordinator
npm run deploy:web
```

Wrangler deve ser dependência local do workspace; não é preciso instalar globalmente. O login abre o navegador. Esse fluxo não usa Docker, WSL, Hyper-V ou máquina virtual.

## Secrets

Somente o Worker pode guardar ou usar credenciais permanentes do TURN e chaves de assinatura. Elas entram como secrets do Wrangler/Cloudflare e nunca como variável `VITE_*`, arquivo commitado ou JavaScript público.

Exemplos futuros:

```powershell
npx wrangler secret put TURN_KEY_ID --cwd apps/coordinator
npx wrangler secret put TURN_API_TOKEN --cwd apps/coordinator
```

O Worker troca a credencial permanente por credenciais TURN temporárias e escopadas. O navegador recebe somente dados temporários necessários à conexão.

## WebSockets e Durable Objects

Usar a API de WebSocket Hibernation nos Durable Objects de signaling. Ela mantém conexões aceitas enquanto o objeto hiberna e reduz tempo faturável quando está ocioso. Cada sessão de signaling deve estar vinculada a host, sala, jogador e ticket; o serviço não pode virar um relay WebSocket aberto.

O diretório precisa de varredura/alarme para expirar heartbeats mesmo sem novas requisições. O adaptador distribuído deve preservar idempotência e reserva atômica; a implementação em memória da Fase 1 não oferece consistência entre datacenters.

## Custos e limites

Cloudflare Pages serve os arquivos estáticos. Workers Free tem limite diário de requisições e Durable Objects SQLite estão disponíveis no plano gratuito, sujeitos aos limites atuais da conta. Tráfego de heartbeat conta como requisição, então o intervalo e a quantidade de hosts precisam caber no orçamento.

Cloudflare STUN é gratuito. O Realtime TURN tem franquia e cobrança por tráfego depois dela; confirme a página de preços antes de abrir o serviço ao público. TURN retransmite apenas quando a conexão direta falha ou quando o usuário escolhe `relay-only`.

## Verificação antes de apontar o domínio

- `npm run verify` aprovado.
- Worker testado localmente com Miniflare/Wrangler.
- Dois dispositivos conseguem registrar host, criar sala e fazer signaling.
- Expiração de heartbeat funciona por alarme, sem depender de nova requisição.
- TURN forçado e CGNAT testados.
- CORS aceita apenas o site de produção e ambientes de preview permitidos.
- Nenhuma chave aparece no bundle do site.
- Rate limiting e limites de tamanho atuam antes do parsing.
- Logs omitem tokens, convites, SDP, ICE e IPs.
- Deploy de preview validado antes de promover a produção.

## Ordem recomendada

Primeiro publicar o coordenador de teste em `workers.dev`. Depois testar o site em preview do Pages. Somente após a conexão entre dois dispositivos funcionar, adicionar `jogos.danipaises.com.br` e `api-jogos.danipaises.com.br`.

