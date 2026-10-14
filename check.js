(function () {
  var button = document.getElementById('run');
  var list = document.getElementById('results');
  var summary = document.getElementById('summary');
  function row(text, ok) {
    var li = document.createElement('li'); li.className = ok ? 'ok' : 'fail';
    li.textContent = (ok ? 'OK — ' : 'FALHA — ') + text; list.appendChild(li);
  }
  button.addEventListener('click', async function () {
    button.disabled = true; list.textContent = ''; summary.textContent = 'Verificando…';
    var failures = 0;
    try {
      if (!window.isSecureContext) { row('A câmera exige HTTPS com certificado válido.', false); failures++; }
      var response = await fetch('./deployment.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Pacote de produção não encontrado (deployment.json: HTTP ' + response.status + '). Envie o ZIP de publicação completo.');
      var manifest;
      try { manifest = await response.json(); } catch (_) { throw new Error('O servidor devolveu uma página HTML no lugar do manifesto de publicação. Verifique a pasta e os redirecionamentos.'); }
      if (!Array.isArray(manifest.files)) throw new Error('Manifesto inválido. Substitua pelo pacote de publicação.');
      for (var i = 0; i < manifest.files.length; i++) {
        var item = manifest.files[i];
        try {
          var result = await fetch('./' + item.path, { method: 'HEAD', cache: 'no-store' });
          if (result.status === 405 || result.status === 501) {
            result = await fetch('./' + item.path, { headers: { Range: 'bytes=0-31' }, cache: 'no-store' });
            if (result.body) await result.body.cancel();
          }
          var mime = (result.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
          var length = Number(result.headers.get('content-length'));
          var validMime = item.kind === 'js' ? /^(text|application)\/(javascript|ecmascript)$/.test(mime) : item.kind === 'css' ? mime === 'text/css' : item.kind === 'wasm' ? mime === 'application/wasm' : mime !== 'text/html';
          if (!result.ok) { row(item.path + ': HTTP ' + result.status + '. Arquivo ausente, sem permissão de leitura ou bloqueado pelo servidor.', false); failures++; }
          else if (!validMime) { row(item.path + ': tipo incorreto (' + (mime || 'não informado') + '). Envie também o .htaccess; arquivos JS devem ser servidos como JavaScript.', false); failures++; }
          else if (result.status === 200 && length && !result.headers.get('content-encoding') && length !== item.bytes) { row(item.path + ': tamanho diferente do pacote. Substitua o arquivo completo.', false); failures++; }
          else row(item.path + ': HTTP ' + result.status + ', ' + (mime || 'binário') + '.', true);
        } catch (_) { row(item.path + ': falha ao acessar o arquivo.', false); failures++; }
      }
      summary.textContent = failures ? 'Encontramos ' + failures + ' problema(s) na instalação. Veja as instruções abaixo.' : 'Arquivos disponíveis e tipos corretos. Volte à experiência; se a câmera falhar, informe a mensagem exibida e seu navegador/dispositivo.';
    } catch (error) { row(error.message || 'Não foi possível verificar a instalação.', false); summary.textContent = 'Instalação incompleta ou bloqueada pela hospedagem.'; }
    finally { button.disabled = false; }
  });
}());
