document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadHotBtn = document.getElementById('downloadHotBtn');
    const statusBox = document.getElementById('status');
    const statusMsg = document.getElementById('statusMsg');
    const campaignInput = document.getElementById('campaignInput');

    // Summary nodes
    const resultsSummary = document.getElementById('resultsSummary');
    const statTotal = document.getElementById('statTotal');
    const statHot = document.getElementById('statHot');
    const statWa = document.getElementById('statWa');

    // WA nodes
    const waGeneratorBtn = document.getElementById('waGeneratorBtn');
    const waModal = document.getElementById('waModal');
    const ordersInput = document.getElementById('ordersInput');
    const waTemplate = document.getElementById('waTemplate');
    const copyWaBtn = document.getElementById('copyWaBtn');

    let scrapedData = [];

    // Listener para mensajes de progreso renderizados desde content.js
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === "progress") {
            showStatus(`Procesando restaurante ${request.current} de ${request.total}...\n(${request.name})`);
        }
        if (request.type === "start") {
            showStatus('Iniciando extracción y recolectando enlaces...');
        }
    });

    function showStatus(message, isError = false) {
        statusBox.classList.remove('hidden');
        statusMsg.innerText = message;
        statusBox.style.backgroundColor = isError ? '#fce8e6' : '#fff3e0';
        statusBox.style.borderColor = isError ? '#fad2cf' : '#ffe0b2';
        statusMsg.style.color = isError ? '#d93025' : '#e65100';
    }

    scrapeBtn.addEventListener('click', async () => {
        try {
            showStatus("Iniciando inyección de script...");
            resultsSummary.classList.add('hidden');
            waModal.classList.add('hidden');
            scrapedData = [];

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes("google.com") && !tab.url.includes("google.es") && !tab.url.includes("google.com.")) {
                showStatus("Esta extensión solo funciona en Google.com o Google Maps.", true);
                return;
            }

            // Ejecutar el script sin bloquear la UI del popup
            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            const data = injectionResults[0].result;

            if (data && data.length > 0) {
                // Quitar duplicados por Enlace o Nombre
                const uniqueData = Array.from(new Map(data.map(item => [item.Enlace || item.Nombre, item])).values());
                scrapedData = uniqueData;

                // Calcular specs
                const total = scrapedData.length;
                const calientes = scrapedData.filter(d => d.Score_Prospecto === "🔥 Caliente").length;
                const conWa = scrapedData.filter(d => d.Tiene_WhatsApp === "Sí").length;

                statTotal.textContent = total;
                statHot.textContent = calientes;
                statWa.textContent = conWa;

                showStatus(`¡Éxito! Se procesaron ${total} prospectos.`);
                statusBox.style.backgroundColor = '#e6f4ea';
                statusBox.style.borderColor = '#ceead6';
                statusMsg.style.color = '#137333';

                resultsSummary.classList.remove('hidden');
            } else {
                showStatus("No se encontraron restaurantes listados.", true);
            }

        } catch (error) {
            console.error(error);
            showStatus("Error extrayendo. Recarga la página y vuelve a intentar.", true);
        }
    });

    function downloadCSV(dataTuples) {
        if (dataTuples.length === 0) return;

        // Añadida las columnas requeridas
        const headers = ["Campaña", "Score_Prospecto", "Nombre", "Calificacion", "Resenas", "Tiene_WhatsApp", "Telefono", "Sitio_Web", "Categoria", "Detalles", "Enlace"];

        const campana = campaignInput.value.trim() || "Sin campaña";

        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            let clean = String(str).replace(/"/g, '""');
            return `"${clean}"`;
        };

        let csvContent = headers.join(",") + "\n";

        dataTuples.forEach(row => {
            const rowData = [
                escapeCSV(campana),
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
        const safeCampana = campana.replace(/[\/\\:*?"<>|]/g, "_");
        a.download = `FastBite_${safeCampana}_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    downloadAllBtn.addEventListener('click', () => {
        downloadCSV(scrapedData);
    });

    downloadHotBtn.addEventListener('click', () => {
        const calientes = scrapedData.filter(d => d.Score_Prospecto === "🔥 Caliente");
        if (calientes.length === 0) {
            alert("No hay prospectos Calientes para descargar.");
            return;
        }
        downloadCSV(calientes);
    });

    // WA Generator Logic
    waGeneratorBtn.addEventListener('click', () => {
        waModal.classList.toggle('hidden');
        if (!waModal.classList.contains('hidden')) {
            updateTemplate();
        }
    });

    function updateTemplate() {
        const pedidos = parseInt(ordersInput.value) || 0;
        const calculo = pedidos * 30 * 25000 * 0.25;
        // Formato para plata (ej: $ 1.500.000)
        const formatMoney = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(calculo);

        waTemplate.value = `Hola [NOMBRE_RESTAURANTE] 👋

Vi tu restaurante en Google Maps y quería contarte algo rápido.

¿Sabías que con ${pedidos} pedidos al día a $25.000 promedio, le estás regalando aproximadamente ${formatMoney} al mes a Rappi?

En FastBiteSaaS te ayudamos a recibir esos pedidos directo por WhatsApp, sin comisiones. Setup en 24 horas, $150.000/mes.

¿Hablamos 10 minutos? 🚀
https://fastbitesas.web.app/`;
    }

    ordersInput.addEventListener('input', updateTemplate);

    copyWaBtn.addEventListener('click', async () => {
        waTemplate.select();
        try {
            await navigator.clipboard.writeText(waTemplate.value);
            copyWaBtn.textContent = "¡Copiado!";
            copyWaBtn.classList.remove('primary');
            copyWaBtn.classList.add('success');
            setTimeout(() => {
                copyWaBtn.textContent = "Copiar Mensaje";
                copyWaBtn.classList.remove('success');
                copyWaBtn.classList.add('primary');
            }, 2000);
        } catch (err) {
            // Fallback old
            document.execCommand('copy');
            copyWaBtn.textContent = "¡Copiado (fallback)!";
        }
    });
});
