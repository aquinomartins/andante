# Andante

Uma figura desenhada em Canvas 2D caminha entre duas árvores numa noite escura. A ponta do indicador (ou do polegar) define seu destino horizontal. As imagens da câmera são processadas no próprio navegador. Também é possível experimentar usando mouse ou toque.

## Instalar e abrir

Use Node.js 24 LTS (versão fixada em `.nvmrc`: 24.19.0). Sem backend, login, banco de dados, microfone ou chave de API.

```sh
npm ci
npm run assets
npm run dev
```

Abra o endereço local informado pelo Vite no computador em que o comando foi executado. Em celular ou acesso remoto, sirva a aplicação via HTTPS. A câmera é solicitada **somente** ao clicar em **Iniciar câmera**. Mostre a mão inteira e mova o dedo para guiar o personagem. A prévia frontal é espelhada, sem recorte; a posição horizontal é invertida uma única vez. A câmera traseira usa orientação normal.

O botão da câmera encerra a experiência e todas as trilhas. **Mouse / toque** retoma o controle alternativo. É possível trocar câmeras quando o navegador oferece mais de uma, escolher o dedo, ocultar a prévia, reiniciar, ativar economia e entrar em tela cheia quando suportada. O diagnóstico mostra medições atualizadas aproximadamente uma vez por segundo.

## Build e hospedagem compartilhada

```sh
npm run build
npm run preview
```

O build estático fica em `dist/`. Não abra `index.html` via `file://`.

1. Ative HTTPS e um certificado válido no painel da hospedagem.
2. Pelo gerenciador de arquivos ou SFTP, crie, por exemplo, `public_html/andante/`.
3. Envie **todo o conteúdo de `dist/`** para essa pasta, incluindo `assets/`, `wasm/`, `models/`, a licença e os avisos de terceiros. Se usar o ZIP de entrega, extraia-o diretamente nessa pasta; `index.html` deve estar no primeiro nível.
4. Abra `https://SEU-DOMINIO/andante/` e clique em **Iniciar câmera**. Esse endereço é um exemplo de formato; substitua pelo domínio real da sua hospedagem.

Também funciona na raiz do domínio. Vite usa `base: './'`; os caminhos do Worker, WASM e modelo são relativos à pasta da aplicação. Os arquivos `.js` devem ser servidos como JavaScript e `.wasm` preferencialmente como `application/wasm`. Não redirecione arquivos ausentes para uma página HTML. Se publicar em um iframe, o host deve permitir câmera (`allow="camera; fullscreen"`) e HTTPS.

Nenhuma hospedagem pública está conectada a este ambiente. O build e o pacote estão prontos para envio; nenhuma URL pública foi criada.

## Assets, versões e privacidade

- `@mediapipe/tasks-vision` **1.1.0**, Vite **8.3.4**, TypeScript **6.0.2** e Playwright **1.64.1** são fixados, com lockfile.
- `public/wasm/` contém os carregadores/binários da mesma versão instalada: módulo para Worker, convencional para execução na página e alternativa sem SIMD. O navegador baixa somente os assets do caminho escolhido.
- O bundle `hand_landmarker` float16, versão **1**, vem do endereço oficial fixo do MediaPipe. Seu SHA-256 está em `public/models/manifest.json` e no instalador. O comando `assets` verifica o hash e a correspondência com o pacote instalado; não atualiza checksums para aceitar outro modelo.
- Os assets são incluídos no build. Não há CDN ou download externo durante o uso. A carga inicial da câmera requer aproximadamente 21 MB sem compressão HTTP (WASM e modelo); as alternativas de compatibilidade aumentam o tamanho da pasta de entrega, mas não são todas baixadas em cada sessão.
- Uma CSP na página restringe conexões à própria hospedagem. O Worker inicia por um Blob para herdar essa política. Isso bloqueia as tentativas de telemetria da biblioteca sem alterar seus arquivos. No desenvolvimento, o Vite permite WebSocket para recarregamento. O build de produção mantém `connect-src 'self'`.
- Não há gravação, envio de quadros, analytics da aplicação ou persistência de imagens.

## Arquitetura e desempenho

`camera.ts` gerencia stream, novos quadros e encerramento. `tracker.ts` gerencia Worker e a alternativa CPU na página. `tracking.worker.ts` executa o modelo; retorna apenas coordenadas das duas pontas e tempo de inferência. `control.ts` mantém posição, suavização, zona morta, aceleração, frenagem e tolerância de 250 ms à ausência de mão. `scene.ts` desenha a figura articulada, ancora os pés na fase de apoio e guarda o cenário estático em cache. `main.ts` coordena interface e animação.

A câmera pede 640 × 480 a até 30 FPS como preferências. A entrada do detector usa largura de 480 px, preservando a proporção; sem ImageBitmap, o fallback utiliza o vídeo. A frequência inicial é 20 Hz em Worker e 10 Hz na página; ajusta-se a cada janela de cinco segundos conforme o custo. Há somente um quadro em andamento, sem fila. Timestamps são monotônicos, e sessões encerradas descartam resultados. Erros liberam o estado de ocupação. A animação é independente, limitada a 60 FPS ou 30 FPS no modo econômico. O canvas limita DPR a 1,5 e largura interna a 1.600 px; tem 46 partículas (25 em economia). A página oculta suspende inferência e animação; parar encerra câmera, callbacks, detector e Worker.

CPU foi escolhida e validada. O caminho GPU não foi habilitado nem anunciado como testado. A resolução de 480 px permanece constante: reduzi-la automaticamente sem medir qualidade em aparelhos reais poderia prejudicar a detecção.

## Testes reproduzíveis

```sh
npm test
npm run test:browser
npm run test:stability
npm run build
npm run test:production
```

Os testes de navegador usam Chromium instalado em `/usr/bin/chromium`; em outra máquina, defina `CHROMIUM_PATH` com o caminho do executável. O Playwright inicia Vite quando necessário. `test:stability` dura ao menos cinco minutos. `test:production` serve automaticamente o build numa subpasta em localhost para validar assets, detector e política de rede. Consulte [docs/VALIDATION.md](docs/VALIDATION.md) para resultados e limitações.

A captura dos testes é **sintética**, gerada a partir de uma imagem oficial de mão do MediaPipe; a inferência e o modelo são reais. Isso verifica o pipeline, mas não comprova precisão, enquadramento ou latência de uma câmera física. Chrome/Edge em computador, Chrome Android e Safari iPhone são os alvos; precisam de validação em aparelhos reais, particularmente troca de câmera, rotação e espelhamento. Emulação de viewport não equivale a teste nesses sistemas.
