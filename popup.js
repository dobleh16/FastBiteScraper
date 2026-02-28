document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const openDashboardBtn = document.getElementById('openDashboardBtn');
    const statusBox = document.getElementById('status');
    const statusMsg = document.getElementById('statusMsg');
    const campaignInput = document.getElementById('campaignInput');
    const resultsSummary = document.getElementById('resultsSummary');
    const statTotal = document.getElementById('statTotal');
    const statHot = document.getElementById('statHot');
    const statWa = document.getElementById('statWa');
    const progressSection = document.getElementById('progressSection');
    const progressLabel = document.getElementById('progressLabel');
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const progressDetail = document.getElementById('progressDetail');
    const dupAlert = document.getElementById('dupAlert');
    const dupList = document.getElementById('dupList');

    let scrapedData = [];
    let isRunning = false;
    let startTime = 0;

    // Listen for progress messages
    chrome.runtime.onMessage.addListener((req) => {
        if (req.type === 'start') {
            showProgress('Iniciando extracción...', 0);
            progressDetail.textContent = 'Recolectando enlaces...';
        }
        if (req.type === 'scrolling') {
            showProgress('Cargando más resultados (auto-scroll)...', 0);
            progressDetail.textContent = 'Haciendo scroll para cargar todos los restaurantes...';
        }
        if (req.type === 'scroll_progress') {
            progressDetail.textContent = `${req.loaded} restaurantes encontrados, cargando más...`;
        }
        if (req.type === 'progress') {
            const pct = Math.round((req.current / req.total) * 100);
            showProgress(`Procesando ${req.current} de ${req.total}`, pct);
            // ETA
            const elapsed = (Date.now() - startTime) / 1000;
            const perItem = elapsed / req.current;
            const remaining = Math.round(perItem * (req.total - req.current));
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            progressDetail.textContent = `${req.name} — ETA: ${mins > 0 ? mins + 'm ' : ''}${secs}s`;
        }
    });

    function showProgress(label, pct) {
        progressSection.classList.remove('hidden');
        progressLabel.textContent = label;
        progressPercent.textContent = pct + '%';
        progressBar.style.width = pct + '%';
    }

    function showStatus(message, type) {
        statusBox.classList.remove('hidden');
        statusMsg.innerText = message;
        if (type === 'error') {
            statusBox.style.backgroundColor = '#fce8e6'; statusBox.style.borderColor = '#fad2cf'; statusMsg.style.color = '#d93025';
        } else if (type === 'success') {
            statusBox.style.backgroundColor = '#e6f4ea'; statusBox.style.borderColor = '#ceead6'; statusMsg.style.color = '#137333';
        } else {
            statusBox.style.backgroundColor = '#fff3e0'; statusBox.style.borderColor = '#ffe0b2'; statusMsg.style.color = '#e65100';
        }
    }

    scrapeBtn.addEventListener('click', async () => {
        try {
            isRunning = true;
            startTime = Date.now();
            scrapeBtn.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
            resultsSummary.classList.add('hidden');
            dupAlert.classList.add('hidden');
            statusBox.classList.add('hidden');
            scrapedData = [];

            showProgress('Preparando...', 0);

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('google.com') && !tab.url.includes('google.es') && !tab.url.includes('google.co')) {
                showStatus('Esta extensión solo funciona en Google.com o Google Maps.', 'error');
                resetButtons();
                return;
            }

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            const data = injectionResults[0].result;
            isRunning = false;
            resetButtons();

            if (data && data.length > 0) {
                const uniqueData = Array.from(new Map(data.map(item => [item.Enlace || item.Nombre, item])).values());
                scrapedData = uniqueData;

                const total = scrapedData.length;
                const calientes = scrapedData.filter(d => d.Score_Prospecto.includes('Caliente')).length;
                const conWa = scrapedData.filter(d => d.Tiene_WhatsApp === 'Sí').length;

                statTotal.textContent = total;
                statHot.textContent = calientes;
                statWa.textContent = conWa;

                showProgress('¡Completado!', 100);
                showStatus(`¡Éxito! Se procesaron ${total} prospectos.`, 'success');
                resultsSummary.classList.remove('hidden');

                // Check for duplicates
                chrome.runtime.sendMessage({ type: 'check_duplicates', data: scrapedData }, (resp) => {
                    if (resp && resp.duplicates && resp.duplicates.length > 0) {
                        dupAlert.classList.remove('hidden');
                        dupList.textContent = resp.duplicates.join(', ');
                    }
                });

                // Save to history
                chrome.runtime.sendMessage({ type: 'save_to_history', data: scrapedData });
            } else {
                showStatus('No se encontraron restaurantes listados.', 'error');
                progressSection.classList.add('hidden');
            }
        } catch (error) {
            console.error(error);
            showStatus('Error extrayendo. Recarga la página y vuelve a intentar.', 'error');
            resetButtons();
        }
    });

    function resetButtons() {
        scrapeBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        isRunning = false;
    }

    cancelBtn.addEventListener('click', () => {
        resetButtons();
        showStatus('Extracción cancelada.', 'error');
        progressSection.classList.add('hidden');
    });

    downloadAllBtn.addEventListener('click', () => { downloadCSV(scrapedData); });

    openDashboardBtn.addEventListener('click', () => {
        if (scrapedData.length === 0) { alert('No hay datos.'); return; }
        chrome.storage.local.set({ fastbite_scraped_data: scrapedData }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        });
    });

    function downloadCSV(data) {
        if (data.length === 0) return;
        const headers = ['Campaña', 'Score_Prospecto', 'Nombre', 'Calificacion', 'Resenas', 'Tiene_WhatsApp', 'Telefono', 'Sitio_Web', 'Categoria', 'Horario', 'Detalles', 'Enlace'];
        const campana = campaignInput.value.trim() || 'Sin campaña';
        const esc = s => { if (s == null) return '""'; return `"${String(s).replace(/"/g, '""')}"`; };
        let csv = headers.join(',') + '\n';
        data.forEach(r => {
            csv += [esc(campana), esc(r.Score_Prospecto), esc(r.Nombre), esc(r.Calificacion), esc(r.Resenas), esc(r.Tiene_WhatsApp), esc(r.Telefono), esc(r.Sitio_Web), esc(r.Categoria), esc(r.Horario), esc(r.Detalles), esc(r.Enlace)].join(',') + '\n';
        });
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FastBite_${campana.replace(/[\/\\:*?"<>|]/g, '_')}_${Date.now()}.csv`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }
});
