document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const statTotal = document.getElementById('statTotal');
    const statHot = document.getElementById('statHot');
    const statWa = document.getElementById('statWa');
    const ordersInput = document.getElementById('ordersInput');
    const waTemplate = document.getElementById('waTemplate');
    const downloadFullCsv = document.getElementById('downloadFullCsv');

    let currentData = [];

    // Load data from storage
    chrome.storage.local.get(['fastbite_scraped_data'], (result) => {
        if (result.fastbite_scraped_data && result.fastbite_scraped_data.length > 0) {
            currentData = result.fastbite_scraped_data;
            updateSummary();
            renderTable();
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay datos disponibles. Vuelve a ejecutar la extracción.</td></tr>';
        }
    });

    function updateTemplate() {
        const pedidos = parseInt(ordersInput.value) || 10;
        const calculo = pedidos * 30 * 25000 * 0.25;
        const formatMoney = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(calculo);

        waTemplate.value = `Hola [NOMBRE_RESTAURANTE] 

Vi tu restaurante en Google Maps y quería contarte algo rápido.

Deja de perder ventas por no responder WhatsApp a tiempo, deja que FastBiteSaaS se haga cargo por ti.

Menú digital profesional + Pedidos automáticos por WhatsApp + Monitor de cocina en tiempo real.
Cero comisiones: Todo lo que vendas es 100% tuyo.

¿Sabías que con ${pedidos} pedidos al día a $25.000 promedio, podrías estar pagando al menos ${formatMoney} al mes en comisiones u otras apps?

Por solo $150.000 COP al mes centralizas tu operación y evitas colapsos.

¿Hablamos 10 minutos? 
https://fastbitesas.web.app/`;
    }

    // Initialize template
    updateTemplate();
    ordersInput.addEventListener('input', () => {
        updateTemplate();
    });

    function updateSummary() {
        const total = currentData.length;
        const calientes = currentData.filter(d => d.Score_Prospecto === "🔥 Caliente").length;
        const conWa = currentData.filter(d => d.Tiene_WhatsApp === "Sí").length;

        statTotal.textContent = total;
        statHot.textContent = calientes;
        statWa.textContent = conWa;
    }

    function getBadgeClass(score) {
        if (!score) return "badge cold";
        if (score.includes("Caliente")) return "badge hot";
        if (score.includes("Tibio")) return "badge warm";
        return "badge cold";
    }

    function generateWaLink(phone, name) {
        if (!phone || phone === "No") return null;

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
            cleanPhone = '57' + cleanPhone;
        }

        const cleanName = (name || "")
            .split(/[-|()]/)[0] // Tomar solo hasta el primer separador
            .trim()
            .toLowerCase()
            .replace(/(^\w|\s\w|[-_]\w)/g, m => m.toUpperCase()); // Convertir a Title Case

        const template = waTemplate.value;
        const message = template.replace(/\[NOMBRE_RESTAURANTE\]/g, cleanName);
        const encodedMessage = encodeURIComponent(message);

        return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }

    function renderTable() {
        tableBody.innerHTML = '';

        currentData.forEach((row, index) => {
            const tr = document.createElement('tr');

            // Nombre
            const tdName = document.createElement('td');
            tdName.innerHTML = `
                <span class="restaurant-name">${row.Nombre}</span>
                <a href="${row.Enlace}" target="_blank" class="restaurant-link">Ver en Maps ↗</a>
            `;

            // Contacto / WA
            const tdContact = document.createElement('td');
            tdContact.innerHTML = `
                <div style="font-size: 0.85rem;">${row.Telefono || 'N/A'}</div>
            `;

            // Score
            const tdScore = document.createElement('td');
            tdScore.innerHTML = `<span class="${getBadgeClass(row.Score_Prospecto)}">${row.Score_Prospecto || 'Frio'}</span>`;

            // Calificacion
            const tdRating = document.createElement('td');
            tdRating.innerHTML = `
                <span class="rating-stars">${row.Calificacion} ★</span>
                <div class="reviews-count">(${row.Resenas} reseñas)</div>
            `;

            // Categoria
            const tdCategory = document.createElement('td');
            tdCategory.innerHTML = `<span style="font-size: 0.85rem; color: #6c757d;">${row.Categoria || 'S/C'}</span>`;

            // Acciones
            const tdActions = document.createElement('td');
            const waLinkButton = document.createElement('button');

            if (row.Telefono && row.Telefono !== "No") {
                waLinkButton.className = "btn wa-btn";
                waLinkButton.innerHTML = `Enviar WA <span style="font-size:1.1rem">💬</span>`;
                waLinkButton.onclick = () => {
                    const url = generateWaLink(row.Telefono, row.Nombre);
                    if (url) window.open(url, '_blank');
                };
            } else {
                waLinkButton.className = "btn wa-btn disabled";
                waLinkButton.innerHTML = "Sin Teléfono";
            }

            tdActions.appendChild(waLinkButton);

            tr.appendChild(tdName);
            tr.appendChild(tdContact);
            tr.appendChild(tdScore);
            tr.appendChild(tdRating);
            tr.appendChild(tdCategory);
            tr.appendChild(tdActions);

            tableBody.appendChild(tr);
        });
    }

    downloadFullCsv.addEventListener('click', () => {
        downloadCSV(currentData);
    });

    function downloadCSV(dataTuples) {
        if (dataTuples.length === 0) return;

        const headers = ["Campaña", "Score_Prospecto", "Nombre", "Calificacion", "Resenas", "Tiene_WhatsApp", "Telefono", "Sitio_Web", "Categoria", "Detalles", "Enlace"];

        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            let clean = String(str).replace(/"/g, '""');
            return `"${clean}"`;
        };

        let csvContent = headers.join(",") + "\n";

        dataTuples.forEach(row => {
            const rowData = [
                escapeCSV("Exportado desde Dashboard"),
                escapeCSV(row.Score_Prospecto),
                escapeCSV(row.Nombre),
                escapeCSV(row.Calificacion),
                escapeCSV(row.Resenas),
                escapeCSV(row.Tiene_WhatsApp),
                escapeCSV(row.Telefono),
                escapeCSV(row.Sitio_Web),
                escapeCSV(row.Categoria),
                escapeCSV(row.Detalles),
                escapeCSV(row.Enlace)
            ];
            csvContent += rowData.join(",") + "\n";
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FastBite_Dashboard_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
});
