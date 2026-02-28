document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const statTotal = document.getElementById('statTotal');
    const statHot = document.getElementById('statHot');
    const statWarm = document.getElementById('statWarm');
    const statCold = document.getElementById('statCold');
    const statWa = document.getElementById('statWa');
    const ordersInput = document.getElementById('ordersInput');
    const waTemplate = document.getElementById('waTemplate');
    const downloadFullCsv = document.getElementById('downloadFullCsv');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const templateSelect = document.getElementById('templateSelect');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const newTemplateBtn = document.getElementById('newTemplateBtn');
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
    const searchInput = document.getElementById('searchInput');
    const scoreFilter = document.getElementById('scoreFilter');
    const waFilter = document.getElementById('waFilter');
    const statusFilter = document.getElementById('statusFilter');
    const miniChart = document.getElementById('miniChart');
    const historyCount = document.getElementById('historyCount');

    let currentData = [];
    let contactStatuses = {};
    let templates = [];
    let sortCol = null, sortAsc = true;

    // ── Load data ──
    chrome.storage.local.get(['fastbite_scraped_data', 'fastbite_contact_status', 'fastbite_templates', 'fastbite_history'], (result) => {
        currentData = result.fastbite_scraped_data || [];
        contactStatuses = result.fastbite_contact_status || {};
        templates = result.fastbite_templates || [];
        const history = result.fastbite_history || [];
        historyCount.textContent = `Historial: ${history.length}`;

        // Apply saved statuses
        currentData.forEach(d => {
            const key = d.Enlace || d.Nombre;
            if (contactStatuses[key]) d.Estado_Contacto = contactStatuses[key];
        });

        if (currentData.length > 0) {
            updateSummary();
            renderChart();
            renderTable();
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#6c757d;">No hay datos. Ejecuta una extracción primero.</td></tr>';
        }
        loadTemplates();
    });

    // ── Summary ──
    function updateSummary() {
        const total = currentData.length;
        const hot = currentData.filter(d => d.Score_Prospecto.includes('Caliente')).length;
        const warm = currentData.filter(d => d.Score_Prospecto.includes('Tibio')).length;
        const cold = currentData.filter(d => d.Score_Prospecto.includes('Frío')).length;
        const wa = currentData.filter(d => d.Tiene_WhatsApp === 'Sí').length;
        statTotal.textContent = total;
        statHot.textContent = hot;
        statWarm.textContent = warm;
        statCold.textContent = cold;
        statWa.textContent = wa;
    }

    // ── Mini Chart ──
    function renderChart() {
        const total = currentData.length || 1;
        const hot = currentData.filter(d => d.Score_Prospecto.includes('Caliente')).length;
        const warm = currentData.filter(d => d.Score_Prospecto.includes('Tibio')).length;
        const cold = currentData.filter(d => d.Score_Prospecto.includes('Frío')).length;
        miniChart.innerHTML = `
      <div class="chart-bar-row"><span class="chart-bar-label">🔥 ${hot}</span><div class="chart-bar-track"><div class="chart-bar-fill hot" style="width:${(hot / total * 100)}%"></div></div></div>
      <div class="chart-bar-row"><span class="chart-bar-label">🟡 ${warm}</span><div class="chart-bar-track"><div class="chart-bar-fill warm" style="width:${(warm / total * 100)}%"></div></div></div>
      <div class="chart-bar-row"><span class="chart-bar-label">❄️ ${cold}</span><div class="chart-bar-track"><div class="chart-bar-fill cold" style="width:${(cold / total * 100)}%"></div></div></div>
    `;
    }

    // ── Templates ──
    function loadTemplates() {
        templateSelect.innerHTML = '';
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id; opt.textContent = t.name;
            templateSelect.appendChild(opt);
        });
        if (templates.length > 0) applyTemplate(templates[0]);
    }

    function applyTemplate(tpl) {
        const pedidos = parseInt(ordersInput.value) || 10;
        const calculo = pedidos * 30 * 25000 * 0.25;
        const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(calculo);
        waTemplate.value = tpl.text.replace(/\[PEDIDOS\]/g, pedidos).replace(/\[CALCULO\]/g, money);
    }

    templateSelect.addEventListener('change', () => {
        const tpl = templates.find(t => t.id === templateSelect.value);
        if (tpl) applyTemplate(tpl);
    });

    ordersInput.addEventListener('input', () => {
        const tpl = templates.find(t => t.id === templateSelect.value);
        if (tpl) applyTemplate(tpl);
    });

    saveTemplateBtn.addEventListener('click', () => {
        const tpl = templates.find(t => t.id === templateSelect.value);
        if (!tpl) return;
        // Save raw template (replace dynamic values back to placeholders)
        const pedidos = parseInt(ordersInput.value) || 10;
        const calculo = pedidos * 30 * 25000 * 0.25;
        const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(calculo);
        let raw = waTemplate.value.replace(new RegExp(pedidos.toString(), 'g'), '[PEDIDOS]').replace(new RegExp(money.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[CALCULO]');
        tpl.text = raw;
        chrome.runtime.sendMessage({ type: 'save_template', template: tpl }, () => {
            saveTemplateBtn.textContent = '✓ Guardado'; setTimeout(() => { saveTemplateBtn.textContent = 'Guardar'; }, 1500);
        });
    });

    newTemplateBtn.addEventListener('click', () => {
        const name = prompt('Nombre de la nueva plantilla:');
        if (!name) return;
        const newTpl = { id: 'tpl_' + Date.now(), name, text: waTemplate.value };
        templates.push(newTpl);
        chrome.runtime.sendMessage({ type: 'save_template', template: newTpl }, () => { loadTemplates(); });
    });

    deleteTemplateBtn.addEventListener('click', () => {
        if (templates.length <= 1) { alert('Debe haber al menos una plantilla.'); return; }
        const id = templateSelect.value;
        templates = templates.filter(t => t.id !== id);
        chrome.runtime.sendMessage({ type: 'delete_template', id }, () => { loadTemplates(); });
    });

    // ── Filters & Sorting ──
    function getFilteredData() {
        let data = currentData.slice();
        const search = searchInput.value.toLowerCase().trim();
        const score = scoreFilter.value;
        const wa = waFilter.value;
        const status = statusFilter.value;

        if (search) data = data.filter(d => d.Nombre.toLowerCase().includes(search) || (d.Categoria || '').toLowerCase().includes(search));
        if (score === 'hot') data = data.filter(d => d.Score_Prospecto.includes('Caliente'));
        else if (score === 'warm') data = data.filter(d => d.Score_Prospecto.includes('Tibio'));
        else if (score === 'cold') data = data.filter(d => d.Score_Prospecto.includes('Frío'));
        if (wa === 'yes') data = data.filter(d => d.Tiene_WhatsApp === 'Sí');
        else if (wa === 'no') data = data.filter(d => d.Tiene_WhatsApp !== 'Sí');
        if (status !== 'all') data = data.filter(d => (d.Estado_Contacto || 'Sin contactar') === status);

        if (sortCol) {
            data.sort((a, b) => {
                let va = a[sortCol] || '', vb = b[sortCol] || '';
                if (sortCol === 'Calificacion') { va = parseFloat(va.replace(',', '.')) || 0; vb = parseFloat(vb.replace(',', '.')) || 0; }
                if (sortCol === 'Score_Prospecto') {
                    const sv = x => x.includes('Caliente') ? 2 : x.includes('Tibio') ? 1 : 0;
                    va = sv(va); vb = sv(vb);
                }
                if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
                return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            });
        }
        return data;
    }

    searchInput.addEventListener('input', renderTable);
    scoreFilter.addEventListener('change', renderTable);
    waFilter.addEventListener('change', renderTable);
    statusFilter.addEventListener('change', renderTable);

    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortCol === col) sortAsc = !sortAsc;
            else { sortCol = col; sortAsc = true; }
            renderTable();
        });
    });

    // ── WA Link Generator ──
    function generateWaLink(phone, name) {
        if (!phone || phone === 'N/A') return null;
        let clean = phone.replace(/\D/g, '');
        if (clean.length === 10 && clean.startsWith('3')) clean = '57' + clean;
        const cleanName = (name || '').split(/[-|()]/)[0].trim().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        const message = waTemplate.value.replace(/\[NOMBRE_RESTAURANTE\]/g, cleanName);
        return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    }

    // ── Render Table ──
    function renderTable() {
        const data = getFilteredData();
        tableBody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            const key = row.Enlace || row.Nombre;
            const status = row.Estado_Contacto || 'Sin contactar';

            tr.innerHTML = `
        <td>
          <span class="restaurant-name">${row.Nombre}</span>
          <a href="${row.Enlace}" target="_blank" class="restaurant-link">Ver en Maps ↗</a>
          ${row.Horario && row.Horario !== 'N/A' ? '<br><span style="font-size:0.7rem;color:#6c757d;">🕐 ' + row.Horario.substring(0, 50) + '</span>' : ''}
        </td>
        <td>
          <div style="font-size:0.85rem">${row.Telefono || 'N/A'}</div>
          ${row.Tiene_WhatsApp === 'Sí' ? '<span style="color:#25D366;font-size:0.75rem;font-weight:600">📱 WhatsApp</span>' : ''}
          ${row.Sitio_Web && row.Sitio_Web !== 'N/A' ? '<br><a href="' + row.Sitio_Web + '" target="_blank" style="font-size:0.72rem;color:#6c757d">🌐 Sitio web</a>' : ''}
        </td>
        <td><span class="badge ${getBadgeClass(row.Score_Prospecto)}">${row.Score_Prospecto}</span></td>
        <td>
          <span class="rating-stars">${row.Calificacion} ★</span>
          <div class="reviews-count">(${row.Resenas} reseñas)</div>
        </td>
        <td><span style="font-size:0.82rem;color:#6c757d">${row.Categoria || 'S/C'}</span></td>
        <td></td>
        <td></td>
      `;

            // Status select
            const statusCell = tr.children[5];
            const sel = document.createElement('select');
            sel.className = 'status-select ' + getStatusClass(status);
            ['Sin contactar', 'Contactado', 'Interesado', 'No interesado', 'Cliente'].forEach(s => {
                const opt = document.createElement('option');
                opt.value = s; opt.textContent = s; if (s === status) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', () => {
                row.Estado_Contacto = sel.value;
                sel.className = 'status-select ' + getStatusClass(sel.value);
                chrome.runtime.sendMessage({ type: 'update_contact_status', key, status: sel.value });
            });
            statusCell.appendChild(sel);

            // WA button
            const actionsCell = tr.children[6];
            const waBtn = document.createElement('button');
            if (row.Telefono && row.Telefono !== 'N/A') {
                waBtn.className = 'btn wa-btn';
                waBtn.innerHTML = 'WA 💬';
                waBtn.onclick = () => { const url = generateWaLink(row.Telefono, row.Nombre); if (url) window.open(url, '_blank'); };
            } else {
                waBtn.className = 'btn wa-btn disabled';
                waBtn.textContent = 'Sin Tel.';
            }
            actionsCell.appendChild(waBtn);
            tableBody.appendChild(tr);
        });
    }

    function getBadgeClass(score) {
        if (!score) return 'cold';
        if (score.includes('Caliente')) return 'hot';
        if (score.includes('Tibio')) return 'warm';
        return 'cold';
    }

    function getStatusClass(s) {
        if (s === 'Contactado') return 'contactado';
        if (s === 'Interesado') return 'interesado';
        if (s === 'No interesado') return 'no-interesado';
        if (s === 'Cliente') return 'cliente';
        return '';
    }

    // ── CSV Download ──
    downloadFullCsv.addEventListener('click', () => { downloadCSV(getFilteredData()); });

    function downloadCSV(data) {
        if (data.length === 0) return;
        const headers = ['Score_Prospecto', 'Nombre', 'Calificacion', 'Resenas', 'Tiene_WhatsApp', 'Telefono', 'Sitio_Web', 'Categoria', 'Horario', 'Estado_Contacto', 'Detalles', 'Enlace'];
        const esc = s => { if (s == null) return '""'; return `"${String(s).replace(/"/g, '""')}"`; };
        let csv = headers.join(',') + '\n';
        data.forEach(r => { csv += headers.map(h => esc(r[h])).join(',') + '\n'; });
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `FastBite_Dashboard_${Date.now()}.csv`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    // ── PDF Download (for field visits) ──
    downloadPdfBtn.addEventListener('click', () => {
        const data = getFilteredData();
        if (data.length === 0) { alert('No hay datos para generar el PDF.'); return; }
        chrome.storage.local.set({ fastbite_report_data: data }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
        });
    });

    // ── Clear History ──
    clearHistoryBtn.addEventListener('click', () => {
        if (!confirm('¿Eliminar todo el historial de prospectos?')) return;
        chrome.storage.local.set({ fastbite_history: [] }, () => {
            historyCount.textContent = 'Historial: 0';
            alert('Historial eliminado.');
        });
    });
});
