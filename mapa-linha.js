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
  var COR = ['#1e6fd9', '#f28c1b'], NOME = ['Ida', 'Volta'];   /* as cores do GMaps */
  var LARGURA = 3, BORDA = 1, LADO = 3, SETA_PX = 85;   /* em pixels da tela: ida e volta iguais; LADO = afastamento onde dividem a rua */
  /* mesmas letras e nomes do GMaps (places.js) */
  var TIPOS = {"terminal": {"nome": "Terminal", "cor": "#2fbf71", "letra": "T"}, "estacao": {"nome": "Esta\u00e7\u00e3o de integra\u00e7\u00e3o", "cor": "#2f7fe0", "letra": "E"}, "ponto": {"nome": "Ponto de integra\u00e7\u00e3o", "cor": "#9b4fd6", "letra": "P"}}, ORDEM = ['terminal', 'estacao', 'ponto'];
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
      '.vl-leg{position:absolute;right:10px;bottom:10px;z-index:900;display:flex;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 120px);align-items:center;gap:4px 6px;padding:5px;background:rgba(255,255,255,.95);border-radius:11px;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:13px;color:#1e2b23}' +
      '.vl-leg button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:1px solid transparent;border-radius:8px;background:none;font:inherit;font-weight:700;color:inherit;cursor:pointer}' +
      '.vl-leg button i{display:block;width:18px;height:5px;border-radius:3px}' +
      '.vl-leg button.on{border-color:#1e2b23;background:#eef3ef}' +
      '.vl-leg button.apagado{opacity:.45}' +
      '.vl-leg span{padding:0 8px;font-weight:700;white-space:nowrap}' +
      '.vl-lugar{background:none;border:0}' +
      '.vl-lugar b,.vl-leg u{display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #fff;color:#fff;font-weight:800;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.45)}' +
      '.vl-lugar b{width:24px;height:24px;font-size:13px;line-height:1}' +
      '.vl-leg u{flex:none;width:20px;height:20px;font-size:11px}' +
      '.vl-leg em{display:inline-flex;align-items:center;gap:5px;padding:0 5px;font-style:normal;font-weight:600;white-space:nowrap}' +
      '.vl-vivo .leaflet-tooltip.vl-nome-lugar{padding:3px 8px;border:0;border-radius:8px;background:rgba(10,16,24,.82);color:#fff;font-size:12px;font-weight:700;line-height:1.25;box-shadow:none;white-space:nowrap}' +
      '.vl-vivo .leaflet-tooltip.vl-nome-lugar::before{display:none}' +
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
  /* caminho com um ponto a cada ~6 m, para achar onde ida e volta dividem a rua */
  function densificar(pts) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], d = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)), n = Math.max(1, Math.ceil(d / 6));
      if (!d) { continue; }
      for (var k = 1; k <= n; k++) { out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    }
    return out;
  }
  function rumos(p) {
    return p.map(function (q, i) { var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], x = b[0] - a[0], y = b[1] - a[1], l = Math.sqrt(x * x + y * y) || 1; return [x / l, y / l]; });
  }
  /* peso 0..1 de cada ponto: 1 onde o outro sentido passa a ate 10 m em direcao contraria (como no GMaps), com rampa de ~25 m */
  function pesos(a, b) {
    var ra = rumos(a), rb = rumos(b), g = {}, C = 10;
    b.forEach(function (q, i) { var k = Math.floor(q[0] / C) + ',' + Math.floor(q[1] / C); (g[k] = g[k] || []).push(i); });
    var divide = a.map(function (q, i) {
      var cx = Math.floor(q[0] / C), cy = Math.floor(q[1] / C);
      for (var x = cx - 1; x <= cx + 1; x++) { for (var y = cy - 1; y <= cy + 1; y++) {
        var l = g[x + ',' + y] || [];
        for (var m = 0; m < l.length; m++) { var o = b[l[m]], d = Math.pow(o[0] - q[0], 2) + Math.pow(o[1] - q[1], 2); if (d <= C * C && ra[i][0] * rb[l[m]][0] + ra[i][1] * rb[l[m]][1] < -0.5) { return true; } }
      } }
      return false;
    });
    var w = divide.map(function (v) { return v ? 9 : 0; }), i;
    for (i = 1; i < w.length; i++) { w[i] = Math.min(w[i], w[i - 1] + 1); }
    for (i = w.length - 2; i >= 0; i--) { w[i] = Math.min(w[i], w[i + 1] + 1); }
    return w.map(function (v) { return Math.min(1, v / 4); });
  }
  /* desloca para a direita do sentido, em pixels (y para baixo) */
  function deslocar(q, dist, w) {
    var nr = [], i;
    for (i = 0; i + 1 < q.length; i++) { var dx = q[i + 1].x - q[i].x, dy = q[i + 1].y - q[i].y, l = Math.sqrt(dx * dx + dy * dy) || 1; nr.push([-dy / l, dx / l]); }
    return q.map(function (p, n) {
      var a = nr[Math.max(0, n - 1)], b = nr[Math.min(nr.length - 1, n)], x = a[0] + b[0], y = a[1] + b[1], l = Math.sqrt(x * x + y * y), d = dist * (w ? w[n] : 1);
      if (l < 0.5) { x = b[0]; y = b[1]; l = 1; }
      return { x: p.x + x / l * d, y: p.y + y / l * d };
    });
  }
  /* setas ao longo da linha, com distancia fixa na tela */
  function setasDe(q, passo) {
    var out = [], falta = passo / 2;
    for (var i = 1; i < q.length; i++) {
      var dx = q[i].x - q[i - 1].x, dy = q[i].y - q[i - 1].y, l = Math.sqrt(dx * dx + dy * dy), at = falta;
      if (!l) { continue; }
      while (at <= l) { out.push({ x: q[i - 1].x + dx * at / l, y: q[i - 1].y + dy * at / l, ang: Math.atan2(dx, -dy) * 180 / Math.PI }); at += passo; }
      falta = at - l;
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
      var escolhido = null;
      var D = sent.map(function (x) { return x ? densificar(x) : null; });
      var W = [D[0] && D[1] ? pesos(D[0], D[1]) : null, D[0] && D[1] ? pesos(D[1], D[0]) : null];
      [1, 0].forEach(function (i) {
        if (!D[i]) { return; }
        var pts = D[i].map(ll);
        cam[i] = {
          fundo: L.polyline(pts, { color: '#fff', weight: LARGURA + 2 * BORDA, opacity: 0.9, interactive: false, lineJoin: 'round' }).addTo(mapa),
          linha: L.polyline(pts, { color: COR[i], weight: LARGURA, opacity: 1, interactive: false, lineJoin: 'round' }).addTo(mapa),
          setas: L.layerGroup().addTo(mapa), tela: null
        };
        todos = todos.concat(pts);
      });
      function iconeSeta(i, ang) {
        return L.divIcon({ className: 'vl-seta', iconSize: [13, 13], iconAnchor: [6.5, 6.5],
          html: '<svg viewBox="0 0 18 18" width="13" height="13" style="transform:rotate(' + Math.round(ang) + 'deg)"><path d="M9 2 L16 15 L2 15 Z" fill="#fff" stroke="' + COR[i] + '" stroke-width="3" stroke-linejoin="round"/></svg>' });
      }
      function pintarSetas() {
        var z = mapa.getZoom();
        [0, 1].forEach(function (i) {
          var c = cam[i]; if (!c) { return; }
          c.setas.clearLayers();
          if (escolhido !== null && escolhido !== i) { return; }
          setasDe(c.tela, SETA_PX).forEach(function (a) { c.setas.addLayer(L.marker(mapa.unproject([a.x, a.y], z), { interactive: false, keyboard: false, icon: iconeSeta(i, a.ang) })); });
        });
      }
      /* o afastamento e em pixels: recalcula a cada zoom */
      function pintarLinhas() {
        var z = mapa.getZoom();
        [0, 1].forEach(function (i) {
          var c = cam[i]; if (!c) { return; }
          c.tela = deslocar(D[i].map(function (p) { return mapa.project(ll(p), z); }), LADO, W[i] || D[i].map(function () { return 0; }));
          var novo = c.tela.map(function (q) { return mapa.unproject([q.x, q.y], z); });
          c.fundo.setLatLngs(novo); c.linha.setLatLngs(novo);
        });
        pintarSetas();
      }
      var ini = tr.ida[0], fim = tr.ida[tr.ida.length - 1];
      L.circleMarker(ll(ini), { radius: 7, color: '#fff', weight: 3, fillColor: '#0b7a1c', fillOpacity: 1, interactive: false }).addTo(mapa);
      if (Math.abs(ini[0] - fim[0]) + Math.abs(ini[1] - fim[1]) > 40) { L.circleMarker(ll(fim), { radius: 7, color: '#fff', weight: 3, fillColor: '#b3261e', fillOpacity: 1, interactive: false }).addTo(mapa); }

      var lugares = (tr.lugares || []).filter(function (t) { return isFinite(t.x) && isFinite(t.y); });
      lugares.forEach(function (t) {
        var k = TIPOS[t.tipo] || TIPOS.terminal;
        L.marker([t.y, t.x], { interactive: false, keyboard: false, zIndexOffset: 2000, icon: L.divIcon({ className: 'vl-lugar', iconSize: [28, 28], iconAnchor: [14, 14], html: '<b style="background:' + k.cor + '">' + k.letra + '</b>' }) })
          .bindTooltip(String(t.nome).replace(/&/g, '&amp;').replace(/</g, '&lt;'), { permanent: true, direction: 'auto', offset: [8, 0], className: 'vl-nome-lugar' }).addTo(mapa);
      });
      var tiposLinha = ORDEM.filter(function (o) { return lugares.some(function (t) { return (TIPOS[t.tipo] ? t.tipo : 'terminal') === o; }); });
      var leg = document.createElement('div'); leg.className = 'vl-leg';
      leg.innerHTML = [0, 1].filter(function (i) { return sent[i]; }).map(function (i) { return '<button type="button" data-s="' + i + '" title="Destacar ' + NOME[i].toLowerCase() + '"><i style="background:' + COR[i] + '"></i>' + NOME[i] + '</button>'; }).join('') +
        tiposLinha.map(function (o) { return '<em><u style="background:' + TIPOS[o].cor + '">' + TIPOS[o].letra + '</u>' + TIPOS[o].nome + '</em>'; }).join('') +
        (tr.km ? '<span>' + Number(tr.km).toFixed(1).replace('.', ',') + ' km</span>' : '');
      el.appendChild(leg);
      L.DomEvent.disableClickPropagation(leg);

      function sentido(n) {
        if (n !== 0 && n !== 1 || !sent[n] || !sent[1]) { n = null; }
        escolhido = n;
        [0, 1].forEach(function (i) {
          var c = cam[i]; if (!c) { return; }
          var ativo = n === null || n === i;
          c.linha.setStyle({ opacity: ativo ? 1 : 0.25 });
          c.fundo.setStyle({ opacity: ativo ? 0.9 : 0.1 });
        });
        if (n !== null && cam[n]) { cam[n].fundo.bringToFront(); cam[n].linha.bringToFront(); }
        pintarSetas();
        [].forEach.call(leg.querySelectorAll('button'), function (x) { var s = +x.getAttribute('data-s'); x.classList.toggle('on', s === n); x.classList.toggle('apagado', n !== null && s !== n); });
      }
      leg.addEventListener('click', function (e) { var bt = e.target.closest('button'); if (!bt) { return; } var s = +bt.getAttribute('data-s'); sentido(escolhido === s ? null : s); });

      var limites = L.latLngBounds(todos);
      function ajustar(anim) { mapa.invalidateSize(false); mapa.fitBounds(limites, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 70], maxZoom: 0.5, animate: !!anim }); }
      ajustar(false);
      pintarLinhas();
      mapa.on('zoomend', pintarLinhas);
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
