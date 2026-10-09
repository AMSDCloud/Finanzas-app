/*******************************************************
 * FRONTEND FINANZAS - v2 (robusto) + PWA
 *******************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbxQmopKqPn1R51brBtmdlS-ECo7tj7fNF9Ym99FyY6Ndv4BmnTKkp_BiQLLZx3fObsa/exec';
const TOKEN   = 'fc51abc5-1d1c-4161-babf-d62d2b2314c83a265a01-6563-40e6-96ab-638360d4537f';

const $   = id => document.getElementById(id);
const fmt = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/********************* LOG Y ERRORES *********************/

function log(msg, data) {
  console.log('[Finanzas]', msg, data !== undefined ? data : '');
}

function mostrarError(msg) {
  console.error('[Finanzas ERROR]', msg);
  let bar = document.getElementById('error-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'error-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#7f1d1d;color:#fff;padding:10px 16px;font-family:monospace;font-size:13px;z-index:9999;border-top:2px solid #f87171';
    document.body.appendChild(bar);
  }
  bar.textContent = '⚠️ ' + msg;
}

/********************* DIAGNÓSTICO *********************/

async function diagnostico() {
  log('========== DIAGNÓSTICO ==========');
  
  // 1) Ver qué mes cree que es "actual"
  const mes = mesActual();
  log('Mes actual según la app:', mes);
  
  // 2) Ver qué transacciones hay (sin filtro)
  const rTx = await api('obtenerTransacciones', {});
  log('Total transacciones en la hoja:', rTx.transacciones?.length || 0);
  
  if (rTx.transacciones?.length) {
    const primeras = rTx.transacciones.slice(0, 5);
    primeras.forEach((t, i) => {
      log('Tx ' + (i+1) + ':', {
        Fecha: String(t['Fecha']),
        Mes: String(t['Mes']),
        Tipo: t['Tipo'],
        Categoria: t['Categoría'],
        MontoReal: t['Monto Real']
      });
    });
  }
  
  // 3) Ver el resumen con filtro por mes actual
  const rResumen = await api('obtenerResumen', { mes });
  log('Resumen CON filtro ' + mes + ':', {
    ingresos: rResumen.ingresos,
    gastos: rResumen.gastos,
    ahorro: rResumen.ahorro
  });
  
  // 4) Ver el resumen sin filtro
  const rResumenTodos = await api('obtenerResumen', {});
  log('Resumen SIN filtro:', {
    ingresos: rResumenTodos.ingresos,
    gastos: rResumenTodos.gastos,
    ahorro: rResumenTodos.ahorro
  });
  
  log('========== FIN DIAGNÓSTICO ==========');
}

// Ejecutar después de 2 segundos de cargada la app
setTimeout(diagnostico, 2000);
/********************* HELPERS FECHAS *********************/

function mesActual() {
  const d = new Date();
  return `${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function mesDeFecha(fechaISO) {
  const [y, m] = fechaISO.split('-');
  return `${MESES[+m - 1]}-${y.slice(2)}`;
}

function fechaBonita(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y) return s;
  return `${d}/${m}/${y}`;
}

/********************* API *********************/

async function api(accion, payload = {}) {
  log('→ API:', accion, payload);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ token: TOKEN, accion, payload }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      mostrarError('Respuesta no-JSON de la API: ' + text.slice(0, 200));
      return { ok: false, error: 'Respuesta inválida' };
    }
    log('← API:', accion, data);
    marcarEstado(data.ok ? 'ok' : 'error');
    return data;
  } catch (e) {
    log('✗ Error fetch:', e.message);
    marcarEstado('error');
    mostrarError('Error de conexión con la API: ' + e.message);
    return { ok: false, error: e.message };
  }
}

function marcarEstado(estado) {
  const el = $('estadoApi');
  if (!el) return;
  el.className = estado;
  el.title = estado === 'ok' ? 'Conectado' : 'Error de conexión';
}

/********************* TABS *********************/

function initTabs() {
  const botones = document.querySelectorAll('.tabs button');
  log('Tabs encontrados:', botones.length);

  botones.forEach(btn => {
    btn.addEventListener('click', () => {
      log('Click tab:', btn.dataset.tab);

      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('activa'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));

      btn.classList.add('activa');
      const target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) {
        target.classList.add('activa');
      } else {
        mostrarError('No existe el panel #tab-' + btn.dataset.tab);
      }
    });
  });
}

/********************* CATEGORÍAS *********************/

let categorias = [];

async function cargarCategorias() {
  const r = await api('obtenerCategorias');
  if (!r.ok) return;
  categorias = r.categorias || [];
  log('Categorías cargadas:', categorias.length);
  actualizarSelectCategorias();
  renderCategorias();
}

function actualizarSelectCategorias() {
  const selTipo = $('tx-tipo');
  const selCat  = $('tx-categoria');
  if (!selTipo || !selCat) return;

  const tipo = selTipo.value;
  const cats = [...new Set(
    categorias.filter(c => c['Tipo'] === tipo).map(c => c['Categoría'])
  )];
  selCat.innerHTML = cats.length
    ? cats.map(c => `<option>${c}</option>`).join('')
    : '<option value="">—</option>';
  actualizarSubcategorias();
}

function actualizarSubcategorias() {
  const selTipo = $('tx-tipo');
  const selCat  = $('tx-categoria');
  const selSub  = $('tx-subcategoria');
  if (!selTipo || !selCat || !selSub) return;

  const tipo = selTipo.value;
  const cat  = selCat.value;
  const subs = categorias
    .filter(c => c['Tipo'] === tipo && c['Categoría'] === cat)
    .map(c => c['Subcategoría'])
    .filter(s => s && s !== '—');
  selSub.innerHTML = '<option value="">—</option>' +
    subs.map(s => `<option>${s}</option>`).join('');
}

function renderCategorias() {
  const cont = $('listaCategorias');
  if (!cont) return;

  if (!categorias.length) {
    cont.innerHTML = '<p class="vacio">No hay categorías cargadas</p>';
    return;
  }
  const porTipo = { Gasto: [], Ingreso: [] };
  categorias.forEach(c => {
    if (!porTipo[c['Tipo']]) porTipo[c['Tipo']] = [];
    porTipo[c['Tipo']].push(c);
  });

  let html = '';
  Object.keys(porTipo).forEach(tipo => {
    html += `<h4 style="margin:1rem 0 0.5rem;color:var(--text-dim);font-size:0.85rem">${tipo}s</h4>`;
    const agrupadas = {};
    porTipo[tipo].forEach(c => {
      if (!agrupadas[c['Categoría']]) agrupadas[c['Categoría']] = [];
      agrupadas[c['Categoría']].push(c['Subcategoría']);
    });
    Object.entries(agrupadas).forEach(([cat, subs]) => {
      const subsValidos = subs.filter(s => s && s !== '—');
      html += `<div class="item">
        <div class="item-info">
          <span class="titulo">${cat}</span>
          <small>${subsValidos.length ? subsValidos.join(' · ') : 'Sin subcategorías'}</small>
        </div>
      </div>`;
    });
  });
  cont.innerHTML = html;
}

/********************* FORM TRANSACCIÓN *********************/

function initFormTx() {
  const form = $('formTx');
  if (!form) { mostrarError('No existe #formTx'); return; }

  const fechaInput = $('tx-fecha');
  if (fechaInput) fechaInput.valueAsDate = new Date();

  const selTipo = $('tx-tipo');
  const selCat  = $('tx-categoria');
  if (selTipo) selTipo.addEventListener('change', actualizarSelectCategorias);
  if (selCat)  selCat.addEventListener('change', actualizarSubcategorias);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;

    const fecha = $('tx-fecha').value;
    const payload = {
      fecha,
      mes: mesDeFecha(fecha),
      tipo: $('tx-tipo').value,
      categoria: $('tx-categoria').value,
      subcategoria: $('tx-subcategoria').value,
      descripcion: $('tx-descripcion').value,
      montoAprox: +$('tx-aprox').value || 0,
      montoReal: +$('tx-real').value || 0,
      metodoPago: $('tx-metodo').value,
      estado: $('tx-estado').value,
      notas: $('tx-notas').value
    };

    const msg = $('tx-msg');
    if (msg) { msg.textContent = 'Guardando...'; msg.style.color = 'var(--text-dim)'; }

    const r = await api('agregarTransaccion', payload);

    if (msg) {
      msg.textContent = r.ok ? '✅ Guardado' : '❌ ' + (r.error || 'Error');
      msg.style.color = r.ok ? 'var(--green)' : 'var(--red)';
    }
    if (btn) btn.disabled = false;

    if (r.ok) {
      form.reset();
      if (fechaInput) fechaInput.valueAsDate = new Date();
      actualizarSelectCategorias();
      await cargarTodo();
      setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
    }
  });
}

/********************* FORM PASIVO *********************/

function initFormPasivo() {
  const form = $('formPasivo');
  if (!form) { mostrarError('No existe #formPasivo'); return; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;

    const payload = {
      tipoPasivo: $('pv-tipo').value,
      acreedor: $('pv-acreedor').value,
      descripcion: $('pv-descripcion').value,
      montoOriginal: +$('pv-original').value || 0,
      saldoActual: +$('pv-saldo').value || 0,
      cuotaMensual: +$('pv-cuota').value || 0,
      tasa: +$('pv-tasa').value || 0,
      tipoTasa: $('pv-tipoTasa').value,
      cuotasTotales: +$('pv-total').value || 0,
      cuotasPagas: +$('pv-pagas').value || 0,
      vencimiento: $('pv-vencimiento').value,
      prioridad: $('pv-prioridad').value
    };

    const msg = $('pv-msg');
    if (msg) { msg.textContent = 'Guardando...'; msg.style.color = 'var(--text-dim)'; }

    const r = await api('agregarPasivo', payload);

    if (msg) {
      msg.textContent = r.ok ? `✅ Pasivo guardado (${r.id})` : '❌ ' + (r.error || 'Error');
      msg.style.color = r.ok ? 'var(--green)' : 'var(--red)';
    }
    if (btn) btn.disabled = false;

    if (r.ok) {
      form.reset();
      await cargarTodo();
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
    }
  });
}

/********************* RENDER: RESUMEN *********************/

async function cargarResumen() {
  const r = await api('obtenerResumen', { mes: mesActual() });
  if (!r.ok) return;

  const setTxt = (id, val, color) => {
    const el = $(id);
    if (!el) return;
    el.textContent = val;
    if (color) el.style.color = color;
  };

  setTxt('r-ingresos', fmt(r.ingresos));
  setTxt('r-gastos', fmt(r.gastos));
  setTxt('r-ahorro', fmt(r.ahorro), r.ahorro >= 0 ? 'var(--green)' : 'var(--red)');
  setTxt('r-desvio', fmt(r.desvio), r.desvio > 0 ? 'var(--red)' : 'var(--green)');
  setTxt('r-deuda', fmt(r.pasivos.deudaTotal));
  setTxt('r-cuota', fmt(r.pasivos.cuotaMensualTotal));
  setTxt('r-ratio', r.ratioDeudaIngreso != null ? r.ratioDeudaIngreso + '%' : '—');
  setTxt('r-pasivos-count', r.pasivos.cantidad);

  const cats = Object.entries(r.porCategoria || {})
    .filter(([k, v]) => v > 0 && !['Sueldo','Freelance','Inversiones','Ventas','Reintegros'].includes(k))
    .sort((a, b) => b[1] - a[1]);

  const total = cats.reduce((s, [, v]) => s + v, 0) || 1;
  const contCat = $('r-categorias');
  if (contCat) {
    contCat.innerHTML = cats.length
      ? cats.map(([k, v]) => `
          <div class="barra-cat">
            <div class="cat-nombre">
              <span>${k}</span>
              <div class="barra"><div style="width:${(v / total * 100).toFixed(1)}%"></div></div>
            </div>
            <span class="monto">${fmt(v)}</span>
          </div>`).join('')
      : '<p class="vacio">Sin movimientos este mes</p>';
  }

  const tipos = Object.entries(r.pasivos.deudaPorTipo || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const totalDeuda = tipos.reduce((s, [, v]) => s + v, 0) || 1;
  const contTipos = $('r-deuda-tipos');
  if (contTipos) {
    contTipos.innerHTML = tipos.length
      ? tipos.map(([k, v]) => `
          <div class="barra-cat">
            <div class="cat-nombre">
              <span>${k}</span>
              <div class="barra"><div style="width:${(v / totalDeuda * 100).toFixed(1)}%;background:var(--purple)"></div></div>
            </div>
            <span class="monto">${fmt(v)}</span>
          </div>`).join('')
      : '<p class="vacio">Sin pasivos activos</p>';
  }
}

/********************* RENDER: TRANSACCIONES *********************/

async function cargarTransacciones() {
  const r = await api('obtenerTransacciones', {});
  if (!r.ok) return;

  const ult = (r.transacciones || []).slice(-20).reverse();
  const cont = $('listaTx');
  if (!cont) return;

  cont.innerHTML = ult.length
    ? ult.map(t => {
        const tipo = t['Tipo'];
        const monto = Number(t['Monto Real']) || 0;
        const clase = tipo === 'Ingreso' ? 'ingreso' : 'gasto';
        return `
          <div class="item">
            <div class="item-info">
              <span class="titulo">${t['Categoría'] || ''}${t['Subcategoría'] ? ' · ' + t['Subcategoría'] : ''}</span>
              <small>${fechaBonita(t['Fecha'])} · ${t['Método Pago'] || ''} · ${t['Descripción'] || 'Sin descripción'}</small>
            </div>
            <span class="monto ${clase}">${tipo === 'Gasto' ? '−' : '+'}${fmt(Math.abs(monto))}</span>
          </div>`;
      }).join('')
    : '<p class="vacio">Sin transacciones cargadas</p>';
}

/********************* RENDER: PASIVOS *********************/

async function cargarPasivos() {
  const r = await api('obtenerPasivos');
  if (!r.ok) return;

  const activos = (r.pasivos || []).filter(p => p['Estado'] === 'Activo');
  const cont = $('listaPasivos');
  if (!cont) return;

  cont.innerHTML = activos.length
    ? activos.map(p => {
        const saldo = Number(p['Saldo Actual']) || 0;
        const cuota = Number(p['Cuota Mensual']) || 0;
        const pagas = Number(p['Cuotas Pagas']) || 0;
        const total = Number(p['Cuotas Totales']) || 0;
        const prioridad = p['Prioridad'] || 'Media';
        return `
          <div class="item-pasivo prioridad-${prioridad}">
            <div class="pasivo-header">
              <div>
                <strong>${p['Acreedor'] || '—'}</strong>
                <div class="tipo">${p['Tipo Pasivo'] || ''} · ${p['Descripción'] || 'Sin descripción'}</div>
              </div>
              <div style="text-align:right">
                <strong style="color:var(--red)">${fmt(saldo)}</strong>
                <div class="tipo">Saldo actual</div>
              </div>
            </div>
            <div class="pasivo-detalle">
              <span>Cuota mensual<strong>${fmt(cuota)}</strong></span>
              <span>Cuotas<strong>${pagas} / ${total}</strong></span>
              <span>Tasa<strong>${p['Tasa'] ? p['Tasa'] + '% ' + (p['Tipo Tasa'] || '') : '—'}</strong></span>
              <span>Vencimiento<strong>${fechaBonita(p['Vencimiento'])}</strong></span>
              <span>Prioridad<strong>${prioridad}</strong></span>
            </div>
          </div>`;
      }).join('')
    : '<p class="vacio">Sin pasivos activos</p>';
}

/********************* CARGA GENERAL *********************/

async function cargarTodo() {
  await Promise.all([
    cargarResumen(),
    cargarTransacciones(),
    cargarPasivos()
  ]);
}

/********************* PWA: PROMPT DE INSTALACIÓN *********************/

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  mostrarBotonInstalar();
});

function mostrarBotonInstalar() {
  if (document.getElementById('btn-instalar')) return;
  const header = document.querySelector('header');
  if (!header) return;

  const btn = document.createElement('button');
  btn.id = 'btn-instalar';
  btn.textContent = '⬇️ Instalar app';
  btn.style.cssText = 'padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:0.85rem;cursor:pointer;font-family:inherit;font-weight:600;margin-left:8px';

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      alertarInstruccionesIOS();
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Instalación:', outcome);
    deferredPrompt = null;
    btn.remove();
  });

  header.appendChild(btn);
}

function alertarInstruccionesIOS() {
  alert(
    'Para instalar en iPhone/iPad:\n\n' +
    '1. Tocá el botón Compartir (cuadrado con flecha hacia arriba)\n' +
    '2. Elegí "Agregar a pantalla de inicio"\n' +
    '3. Confirmá con "Agregar"'
  );
}

function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function esStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

if (esIOS() && !esStandalone()) {
  window.addEventListener('load', () => {
    setTimeout(mostrarBotonInstalar, 1000);
  });
}

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App instalada');
  const btn = document.getElementById('btn-instalar');
  if (btn) btn.remove();
});

/********************* INIT *********************/

async function init() {
  log('🚀 Init frontend');

  // 1) Registrar handlers de UI (siempre primero)
  initTabs();
  initFormTx();
  initFormPasivo();

  const mesEl = $('mesActual');
  if (mesEl) mesEl.textContent = 'Mes: ' + mesActual();

  // 2) Verificar conexión
  await api('ping');

  // 3) Cargar datos
  await cargarCategorias();
  await cargarTodo();

  log('✅ Frontend listo');
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
