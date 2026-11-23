/* Mapa interativo do trajeto de uma linha da VCA (janela das paginas de linhas).
   O tema do blog carrega este arquivo so quando a janela abre, entao melhorar o mapa nao exige mexer no tema.
   Usa os quadradinhos do GitHub Pages (quadradinhos.json) e o Leaflet.
   VCAMapaLinha.abrir(elemento, trajeto) -> Promise de {mais, menos, reset, sentido(0|1|null), destruir}
   trajeto = item do linhas.json: {ida:[[x,y]...], volta, km}. */
(function (g) {
  'use strict';
  var atual = document.currentScript && document.currentScript.src;
  var BASE = (g.VCA_MAPA_URL || (atual ? atual.replace(/\/[^\/]*$/, '') : 'https://gabrielcicerogoias2015.github.io/vca-mapa')).replace(/\/$/, '');
  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var COR = ['#0a5fc4', '#e8760a'], NOME = ['Ida', 'Volta'];
  var pLeaflet = null, pQuad = null;

  function css() {
    if (document.getElementById('vl-vivo-css')) { return; }
    var s = document.createElement('style'); s.id = 'vl-vivo-css';
    s.textContent =
      '.vl-vivo.leaflet-container{background:#4a7b9d;font:inherit}' +
      '.vl-vivo img.leaflet-tile{mix-blend-mode:normal!important;width:257px!important;height:257px!important;max-width:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important;background:none!important}' +
      '.vl-vivo .leaflet-control-zoom{margin:0 0 10px 10px;border:0;box-shadow:none;display:flex;gap:6px}' +
      '.vl-vivo .leaflet-control-zoom a{width:40px;height:40px;line-height:38px;font-size:21px;border:1px solid rgba(0,0,0,.2);border-radius:10px!important;background:rgba(255,255,255,.94);color:#1e2b23}' +
      '.vl-vivo .leaflet-control-zoom a:hover{background:#ffb000;border-color:#ffb000}' +
      '.vl-leg{position:absolute;right:10px;bottom:10px;z-index:900;display:flex;align-items:center;gap:6px;padding:5px;background:rgba(255,255,255,.95);border-radius:11px;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:13px;color:#1e2b23}' +
      '.vl-leg button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:1px solid transparent;border-radius:8px;background:none;font:inherit;font-weight:700;color:inherit;cursor:pointer}' +
      '.vl-leg button i{display:block;width:18px;height:5px;border-radius:3px}' +
      '.vl-leg button.on{border-color:#1e2b23;background:#eef3ef}' +
      '.vl-leg button.apagado{opacity:.45}' +
      '.vl-leg span{padding:0 8px;font-weight:700;white-space:nowrap}' +
      '.vl-seta{background:none;border:0}' +
      '.vl-seta svg{display:block;filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff)}' +
      '@media (max-width:520px){.vl-leg{font-size:12px}.vl-leg button{padding:0 7px}.vl-leg span{padding:0 4px}}';
    document.head.appendChild(s);
  }
  function carregarLeaflet() {
    if (g.L && g.L.map) { return Promise.resolve(g.L); }
    if (pLeaflet) { return pLeaflet; }
    pLeaflet = new Promise(function (ok, erro) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET + 'leaflet.min.css'; document.head.appendChild(l);
      var s = document.createElement('script'); s.src = LEAFLET + 'leaflet.min.js';
      s.onload = function () { ok(g.L); };
      s.onerror = function () { pLeaflet = null; erro(new Error('leaflet')); };
      document.head.appendChild(s);
    });
    return pLeaflet;
  }
  function carregarQuad() {
    if (pQuad) { return pQuad; }
    pQuad = fetch(BASE + '/quadradinhos.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .catch(function (e) { pQuad = null; throw e; });
    return pQuad;
  }
  /* pontos ao longo da linha, para as setas do sentido */
  function setasDe(pts, n) {
    var soma = [0], i, out = [];
    for (i = 1; i < pts.length; i++) { soma[i] = soma[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2)); }
    var tot = soma[soma.length - 1]; if (!tot) { return out; }
    for (var k = 1; k <= n; k++) {
      var alvo = tot * k / (n + 1), j = 1;
      while (j < pts.length - 1 && soma[j] < alvo) { j++; }
      var a = pts[j - 1], b = pts[j], f = (alvo - soma[j - 1]) / Math.max(0.001, soma[j] - soma[j - 1]);
      out.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI });
    }
    return out;
  }

  function abrir(el, tr) {
    css();
    return Promise.all([carregarLeaflet(), carregarQuad()]).then(function (x) {
      var L = x[0], Q = x[1], mu = Q.mundo, b = [[mu.yMin, mu.xMin], [mu.yMax, mu.xMax]];
      var crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1, -mu.xMin, -1, mu.yMax) });
      var mapa = L.map(el, { crs: crs, minZoom: -4, maxZoom: 2, zoomSnap: 0.25, attributionControl: false, zoomControl: false, keyboard: false,
        maxBounds: [[b[0][0] - 500, b[0][1] - 500], [b[1][0] + 500, b[1][1] + 500]] });
      L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
      var zNat = Math.round(-Math.log(Q.metrosPorPixel) / Math.LN2);
      L.tileLayer(BASE + '/' + (Q.pasta ? Q.pasta + '/' : '') + '{z}/{x}/{y}.webp' + (Q.gerado ? '?v=' + encodeURIComponent(Q.gerado) : ''), { tileSize: Q.tam || 256, noWrap: true, bounds: b,
        minZoom: -4, maxZoom: 2, minNativeZoom: zNat - Q.zMax, maxNativeZoom: zNat, zoomOffset: Q.zMax - zNat, keepBuffer: 1, updateWhenZooming: false }).addTo(mapa);

      var ll = function (p) { return [p[1], p[0]]; }, sent = [tr.ida, tr.volta && tr.volta.length > 1 ? tr.volta : null], cam = [], todos = [];
      /* a volta vai por baixo e mais larga: onde as duas dividem a rua, as duas cores aparecem */
      [1, 0].forEach(function (i) {
        if (!sent[i]) { return; }
        var pts = sent[i].map(ll), larg = i ? 8 : 4;
        var fundo = L.polyline(pts, { color: '#fff', weight: larg + 3, opacity: 0.85, interactive: false }).addTo(mapa);
        var linha = L.polyline(pts, { color: COR[i], weight: larg, opacity: 1, interactive: false, lineJoin: 'round' }).addTo(mapa);
        var setas = setasDe(sent[i], 7).map(function (s) {
          return L.marker([s.y, s.x], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'vl-seta', iconSize: [18, 18], iconAnchor: [9, 9],
            html: '<svg viewBox="0 0 18 18" width="18" height="18" style="transform:rotate(' + Math.round(s.ang) + 'deg)"><path d="M9 2 L15 15 L9 12 L3 15 Z" fill="' + COR[i] + '" stroke="#fff" stroke-width="1.4"/></svg>' }) });
        });
        cam[i] = { fundo: fundo, linha: linha, setas: setas, larg: larg };
        todos = todos.concat(pts);
      });
      var ini = tr.ida[0], fim = tr.ida[tr.ida.length - 1];
      L.circleMarker(ll(ini), { radius: 7, color: '#fff', weight: 3, fillColor: '#0b7a1c', fillOpacity: 1, interactive: false }).addTo(mapa);
      if (Math.abs(ini[0] - fim[0]) + Math.abs(ini[1] - fim[1]) > 40) { L.circleMarker(ll(fim), { radius: 7, color: '#fff', weight: 3, fillColor: '#b3261e', fillOpacity: 1, interactive: false }).addTo(mapa); }

      var leg = document.createElement('div'); leg.className = 'vl-leg';
      leg.innerHTML = [0, 1].filter(function (i) { return sent[i]; }).map(function (i) { return '<button type="button" data-s="' + i + '" title="Destacar ' + NOME[i].toLowerCase() + '"><i style="background:' + COR[i] + '"></i>' + NOME[i] + '</button>'; }).join('') +
        (tr.km ? '<span>' + Number(tr.km).toFixed(1).replace('.', ',') + ' km</span>' : '');
      el.appendChild(leg);
      L.DomEvent.disableClickPropagation(leg);

      var escolhido = null;
      function sentido(n) {
        if (n !== 0 && n !== 1 || !sent[n] || !sent[1]) { n = null; }
        escolhido = n;
        [0, 1].forEach(function (i) {
          var c = cam[i]; if (!c) { return; }
          var ativo = n === null || n === i;
          c.linha.setStyle({ opacity: ativo ? 1 : 0.25, weight: n === i ? 6 : c.larg });
          c.fundo.setStyle({ opacity: ativo ? 0.85 : 0.1, weight: (n === i ? 6 : c.larg) + 3 });
          c.setas.forEach(function (m) { if (n === i) { m.addTo(mapa); } else { mapa.removeLayer(m); } });
        });
        if (n !== null && cam[n]) { cam[n].fundo.bringToFront(); cam[n].linha.bringToFront(); }
        [].forEach.call(leg.querySelectorAll('button'), function (x) { var s = +x.getAttribute('data-s'); x.classList.toggle('on', s === n); x.classList.toggle('apagado', n !== null && s !== n); });
      }
      leg.addEventListener('click', function (e) { var bt = e.target.closest('button'); if (!bt) { return; } var s = +bt.getAttribute('data-s'); sentido(escolhido === s ? null : s); });

      var limites = L.latLngBounds(todos);
      function ajustar(anim) { mapa.invalidateSize(false); mapa.fitBounds(limites, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 70], maxZoom: 0.5, animate: !!anim }); }
      ajustar(false);
      if (!sent[1]) { sentido(0); }
      var ro = g.ResizeObserver ? new ResizeObserver(function () { mapa.invalidateSize(false); }) : null; if (ro) { ro.observe(el); }
      return {
        mais: function () { mapa.zoomIn(0.5); },
        menos: function () { mapa.zoomOut(0.5); },
        reset: function () { ajustar(true); },
        sentido: sentido,
        destruir: function () { if (ro) { ro.disconnect(); } mapa.remove(); if (leg.parentNode) { leg.parentNode.removeChild(leg); } }
      };
    });
  }
  g.VCAMapaLinha = { abrir: abrir };
})(window);
