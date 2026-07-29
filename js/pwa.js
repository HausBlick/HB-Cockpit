// HB-Cockpit PWA — Service-Worker-Registrierung + Install-Hilfen.
//  • Android/Chrome: beforeinstallprompt abfangen -> eigener „Installieren"-Banner.
//  • iOS/Safari: kein Prompt möglich -> Hinweis-Banner „Teilen -> Zum Home-Bildschirm".
// Rein additiv; ändert am bestehenden Portal nichts.
(function () {
  'use strict';

  // 1) Service Worker registrieren (nur secure context: HTTPS oder localhost)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // Schon als App gestartet? Dann keine Install-Hinweise.
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
  if (isStandalone) return;

  var DISMISS_KEY = 'hb_pwa_dismissed';
  if (localStorage.getItem(DISMISS_KEY) === '1') return;

  function makeBanner(html) {
    var el = document.createElement('div');
    el.id = 'hb-pwa-banner';
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;'
      + 'background:#fff;color:#373737;border:1px solid #e5e5e5;border-radius:14px;'
      + 'box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px 14px;display:flex;align-items:center;'
      + 'gap:12px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;max-width:520px;margin:0 auto;';
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }
  function dismiss(el) { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} if (el) el.remove(); }
  var ICON = '<img src="/icons/icon-192.png" alt="" style="width:38px;height:38px;border-radius:9px;flex:0 0 auto">';
  var CLOSE = '<button data-x="1" aria-label="Schließen" style="background:none;border:0;color:#999;font-size:20px;line-height:1;cursor:pointer;padding:0 4px">&times;</button>';

  // 2) Android/Chrome
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var el = makeBanner(
      ICON +
      '<div style="flex:1 1 auto;line-height:1.35"><b>HB-Cockpit installieren</b><br>' +
      '<span style="color:#666">Als App auf den Startbildschirm.</span></div>' +
      '<button data-install="1" style="background:#687451;color:#fff;border:0;border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer">Installieren</button>' +
      CLOSE
    );
    el.querySelector('[data-install]').onclick = function () {
      el.remove();
      if (!deferred) return;
      deferred.prompt();
      if (deferred.userChoice) deferred.userChoice.catch(function () {});
      deferred = null;
    };
    el.querySelector('[data-x]').onclick = function () { dismiss(el); };
  });
  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('hb-pwa-banner'); if (b) b.remove();
  });

  // 3) iOS/Safari (kein beforeinstallprompt) -> manueller Hinweis
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
  var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  if (isIOS && isSafari) {
    window.addEventListener('load', function () {
      var el = makeBanner(
        ICON +
        '<div style="flex:1 1 auto;line-height:1.35"><b>HB-Cockpit als App</b><br>' +
        '<span style="color:#666">Tippe auf <b>Teilen</b> (Symbol mit Pfeil nach oben) und dann <b>„Zum Home-Bildschirm"</b>.</span></div>' +
        CLOSE
      );
      el.querySelector('[data-x]').onclick = function () { dismiss(el); };
    });
  }
})();
