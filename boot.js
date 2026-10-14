(function () {
  var timer;
  function ready() { return document.documentElement.getAttribute('data-andante-ready') === 'true'; }
  function failed() {
    if (ready()) return;
    var warning = document.getElementById('boot-status');
    if (!warning) return;
    warning.hidden = false;
    document.getElementById('boot-message').textContent = 'A experiência não conseguiu iniciar. Recarregue a página ou verifique a instalação pelo link abaixo.';
  }
  window.addEventListener('error', failed, true);
  window.addEventListener('unhandledrejection', failed);
  window.addEventListener('andante-ready', function () { clearTimeout(timer); });
  timer = setTimeout(failed, 6500);
}());
