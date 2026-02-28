document.addEventListener('DOMContentLoaded', () => {
    const reportDate = document.getElementById('reportDate');
    const reportSummary = document.getElementById('reportSummary');
    const reportBody = document.getElementById('reportBody');
    const printBtn = document.getElementById('printBtn');

    // Set date
    const now = new Date();
    reportDate.textContent = `Generado: ${now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

    // Load data
    chrome.storage.local.get(['fastbite_report_data'], (result) => {
        const data = result.fastbite_report_data || [];

        if (data.length === 0) {
            reportBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px">No hay datos para el reporte.</td></tr>';
            return;
        }

        // Summary cards
        const total = data.length;
        const hot = data.filter(d => d.Score_Prospecto.includes('Caliente')).length;
        const warm = data.filter(d => d.Score_Prospecto.includes('Tibio')).length;
        const wa = data.filter(d => d.Tiene_WhatsApp === 'Sí').length;
        const withPhone = data.filter(d => d.Telefono && d.Telefono !== 'N/A').length;

        reportSummary.innerHTML = `
      <div class="summary-card"><div class="value">${total}</div><div class="label">Total Prospectos</div></div>
      <div class="summary-card hot"><div class="value">${hot}</div><div class="label">🔥 Calientes</div></div>
      <div class="summary-card warm"><div class="value">${warm}</div><div class="label">🟡 Tibios</div></div>
      <div class="summary-card wa"><div class="value">${wa}</div><div class="label">📱 WhatsApp</div></div>
      <div class="summary-card"><div class="value">${withPhone}</div><div class="label">📞 Con Teléfono</div></div>
    `;

        // Table rows
        data.forEach((row, i) => {
            const scoreClass = row.Score_Prospecto.includes('Caliente') ? 'score-hot' : row.Score_Prospecto.includes('Tibio') ? 'score-warm' : 'score-cold';
            const scoreText = row.Score_Prospecto.replace(/[🔥🟡❄️]/g, '').trim();
            const horarioShort = row.Horario && row.Horario !== 'N/A' ? row.Horario.substring(0, 60) : '—';

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td style="text-align:center">${i + 1}</td>
        <td><strong>${row.Nombre}</strong></td>
        <td>${row.Detalles || '—'}</td>
        <td>${row.Telefono || '—'}${row.Tiene_WhatsApp === 'Sí' ? ' 📱' : ''}</td>
        <td>${row.Categoria || '—'}</td>
        <td>${row.Calificacion} ★<br><small>(${row.Resenas})</small></td>
        <td><span class="${scoreClass}">${scoreText}</span></td>
        <td style="font-size:0.72rem">${horarioShort}</td>
        <td><div class="notes-cell"></div></td>
      `;
            reportBody.appendChild(tr);
        });

        // Auto-focus print button
        printBtn.focus();
    });

    // Print
    printBtn.addEventListener('click', () => {
        window.print();
    });
});
