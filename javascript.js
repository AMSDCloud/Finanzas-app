/*******************************************************
 * FRONTEND FINANZAS
 * Conecta con Apps Script publicado como Web App
 *******************************************************/

const API_URL = 'https://script.google.com/macros/s/AKfycbxQmopKqPn1R51brBtmdlS-ECo7tj7fNF9Ym99FyY6Ndv4BmnTKkp_BiQLLZx3fObsa/exec';
const TOKEN   = 'fc51abc5-1d1c-4161-babf-d62d2b2314c83a265a01-6563-40e6-96ab-638360d4537f';

const $   = id => document.getElementById(id);
const fmt = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

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
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ token: TOKEN, accion, payload }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    const data = await res.json();
    marcarEstado(data.ok ? 'ok' : 'error');
    return data;
  } catch (e) {
    marcarEstado('error');
    return { ok: false, error: e.message };
  }
}

function marcarEstado(estado) {
  const el = $('estadoApi');
  el.className = estado;
  el.title = estado === 'ok' ? 'Conectado' : 'Error de conexión';
}

/********************* TABS *********************/

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('activa'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));
    btn.classList.add('activa');
    $('tab-' + btn.dataset.tab).classList.add('activa');
  };
});

/********************* CATEGORÍAS *********************/

let categorias = [];

async function cargarCategorias() {
  const r = await api('obtenerCategorias');
  if (!r.ok) return;
  categorias = r.categorias || [];
  actualizarSelectCategorias();
  renderCategorias();
}

function actualizarSelectCategorias() {
  const tipo = $('tx-tipo').value;
  const cats = [...new Set(
    categorias.filter(c => c['Tipo'] === tipo).map(c => c['Categoría'])
  )];
  $('tx-categoria').innerHTML = cats.length
    ? cats.map(c => `<option>${c}</option>`).join('')
    : '<option value="">—</option>';
  actualizarSubcategorias();
}

function actualizarSubcategorias() {
  const tipo = $('tx-tipo').value;
  const cat  = $('tx-categoria').value;
  const subs = categorias
    .filter(c => c['Tipo'] === tipo && c['Categoría'] === cat)
    .map(c => c['Subcategoría'])
    .filter(s => s && s !== '—');
  $('tx-subcategoria').innerHTML = '<option value="">—</option>' +
    subs.map(s => `<option>${s}</option>`).join('');
}

function renderCategorias() {
  const cont = $('listaCategorias');
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

$('tx-tipo').onchange = actualizarSelectCategorias;
$('tx-categoria').onchange = actualizarSubcategorias;

/********************* FORM TRANSACCIÓN *********************/

$('tx-fecha').valueAsDate = new Date();

$('formTx').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;

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

  $('tx-msg').textContent = 'Guardando...';
  $('tx-msg').style.color = 'var(--text-dim)';

  const r = await api('agregarTransaccion', payload);

  $('tx-msg').textContent = r.ok ? '✅ Guardado' : '❌ ' + (r.error || 'Error');
  $('tx-msg').style.color = r.ok ? 'var(--green)' : 'var(--red)';
  btn.disabled = false;

  if (r.ok) {
    e.target.reset();
    $('tx-fecha').valueAsDate = new Date();
    actualizarSelectCategorias();
    await cargarTodo();
    setTimeout(() => { $('tx-msg').textContent = ''; }, 3000);
  }
};

/********************* FORM PASIVO *********************/

$('formPasivo').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;

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

  $('pv-msg').textContent = 'Guardando...';
  $('pv-msg').style.color = 'var(--text-dim)';

  const r = await api('agregarPasivo', payload);

  $('pv-msg').textContent = r.ok ? `✅ Pasivo guardado (${r.id})` : '❌ ' + (r.error || 'Error');
  $('pv-msg').style.color = r.ok ? 'var(--green)' : 'var(--red)';
  btn.disabled = false;

  if (r.ok) {
    e.target.reset();
    await cargarTodo();
    setTimeout(() => { $('pv-msg').textContent = ''; }, 4000);
  }
};

/********************* RENDER: RESUMEN *********************/

async function cargarResumen() {
  const mes = mesActual();
  const r = await api('obtenerResumen', { mes });
  if (!r.ok) return;

  $('r-ingresos').textContent = fmt(r.ingresos);
  $('r-gastos').textContent   = fmt(r.gastos);
  $('r-ahorro').textContent   = fmt(r.ahorro);
  $('r-ahorro').style.color   = r.ahorro >= 0 ? 'var(--green)' : 'var(--red)';
  $('r-desvio').textContent   = fmt(r.desvio);
  $('r-desvio').style.color   = r.desvio > 0 ? 'var(--red)' : 'var(--green)';
  $('r-deuda').textContent    = fmt(r.pasivos.deudaTotal);
  $('r-cuota').textContent    = fmt(r.pasivos.cuotaMensualTotal);
  $('r-ratio').textContent    = r.ratioDeudaIngreso != null ? r.ratioDeudaIngreso + '%' : '—';
  $('r-pasivos-count').textContent = r.pasivos.cantidad;

  // Categorías de gasto (excluye ingresos y cuentas comunes)
  const cats = Object.entries(r.porCategoria || {})
    .filter(([k, v]) => v > 0 && !['Sueldo','Freelance','Inversiones','Ventas','Reintegros'].includes(k))
    .sort((a, b) => b[1] - a[1]);

  const total = cats.reduce((s, [, v]) => s + v, 0) || 1;

  $('r-categorias').innerHTML = cats.length
    ? cats.map(([k, v]) => `
        <div class="barra-cat">
          <div class="cat-nombre">
            <span>${k}</span>
            <div class="barra"><div style="width:${(v / total * 100).toFixed(1)}%"></div></div>
          </div>
          <span class="monto">${fmt(v)}</span>
        </div>`).join('')
    : '<p class="vacio">Sin movimientos este mes</p>';

  // Deuda por tipo de pasivo
  const tipos = Object.entries(r.pasivos.deudaPorTipo || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const totalDeuda = tipos.reduce((s, [, v]) => s + v, 0) || 1;

  $('r-deuda-tipos').innerHTML = tipos.length
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

/********************* RENDER: TRANSACCIONES *********************/

async function cargarTransacciones() {
  const r = await api('obtenerTransacciones', {});
  if (!r.ok) return;

  const ult = (r.transacciones || []).slice(-20).reverse();

  $('listaTx').innerHTML = ult.length
    ? ult.map(t => {
        const tipo = t['Tipo'];
        const monto = Number(t['Monto Real']) || 0;
        const clase = tipo === 'Ingreso' ? 'ingreso' : 'gasto';
        return `
          <div class="item">
            <div class="item-info">
              <span class="titulo">${t['Categoría'] || ''}${t['Subcategoría'] ? ' · ' + t['Subcategoría'] : ''}</span>
              <small>
                ${fechaBonita(t['Fecha'])} · ${t['Método Pago'] || ''} · ${t['Descripción'] || 'Sin descripción'}
              </small>
            </div>
            <span class="monto ${clase}">
              ${tipo === 'Gasto' ? '−' : '+'}${fmt(Math.abs(monto))}
            </span>
          </div>`;
      }).join('')
    : '<p class="vacio">Sin transacciones cargadas</p>';
}

/********************* RENDER: PASIVOS *********************/

async function cargarPasivos() {
  const r = await api('obtenerPasivos');
  if (!r.ok) return;

  const activos = (r.pasivos || []).filter(p => p['Estado'] === 'Activo');

  $('listaPasivos').innerHTML = activos.length
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

async function init() {
  $('mesActual').textContent = 'Mes: ' + mesActual();

  // Ping inicial para verificar conexión
  await api('ping');

  await cargarCategorias();
  await cargarTodo();
}

init();
