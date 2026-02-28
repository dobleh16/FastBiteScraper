// FastBiteScraper v2.0 - Background Service Worker
// Manages: data persistence, duplicate detection, WA templates, contact status

const DEFAULT_TEMPLATE = {
    id: 'default',
    name: 'Plantilla Principal',
    text: `Hola [NOMBRE_RESTAURANTE] 👋

Vi tu restaurante en Google Maps y quería contarte algo rápido.

Deja de perder ventas por no responder WhatsApp a tiempo, deja que FastBiteSaaS se haga cargo por ti.

Menú digital profesional + Pedidos automáticos por WhatsApp + Monitor de cocina en tiempo real.
Cero comisiones: Todo lo que vendas es 100% tuyo.

¿Sabías que con [PEDIDOS] pedidos al día a $25.000 promedio, podrías estar pagando al menos [CALCULO] al mes en comisiones u otras apps?

Por solo $150.000 COP al mes centralizas tu operación y evitas colapsos.

¿Hablamos 10 minutos? 🚀
https://fastbitesas.web.app/`
};

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['fastbite_history', 'fastbite_templates', 'fastbite_contact_status'], (result) => {
        const updates = {};
        if (!result.fastbite_history) updates.fastbite_history = [];
        if (!result.fastbite_templates) updates.fastbite_templates = [DEFAULT_TEMPLATE];
        if (!result.fastbite_contact_status) updates.fastbite_contact_status = {};
        if (Object.keys(updates).length > 0) chrome.storage.local.set(updates);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'check_duplicates') {
        chrome.storage.local.get(['fastbite_history'], (result) => {
            const history = result.fastbite_history || [];
            const duplicates = [];
            (message.data || []).forEach(item => {
                const isDup = history.some(h =>
                    (h.Telefono && h.Telefono !== 'N/A' && h.Telefono === item.Telefono) ||
                    (h.Nombre === item.Nombre && h.Detalles === item.Detalles)
                );
                if (isDup) duplicates.push(item.Nombre);
            });
            sendResponse({ duplicates });
        });
        return true;
    }

    if (message.type === 'save_to_history') {
        chrome.storage.local.get(['fastbite_history'], (result) => {
            const history = result.fastbite_history || [];
            (message.data || []).forEach(item => {
                const exists = history.some(h =>
                    (h.Telefono && h.Telefono !== 'N/A' && h.Telefono === item.Telefono) ||
                    (h.Nombre === item.Nombre && h.Detalles === item.Detalles)
                );
                if (!exists) history.push({ ...item, _savedAt: new Date().toISOString() });
            });
            chrome.storage.local.set({ fastbite_history: history });
            sendResponse({ saved: true, total: history.length });
        });
        return true;
    }

    if (message.type === 'update_contact_status') {
        chrome.storage.local.get(['fastbite_contact_status'], (result) => {
            const statuses = result.fastbite_contact_status || {};
            statuses[message.key] = message.status;
            chrome.storage.local.set({ fastbite_contact_status: statuses });
            sendResponse({ updated: true });
        });
        return true;
    }

    if (message.type === 'save_template') {
        chrome.storage.local.get(['fastbite_templates'], (result) => {
            const templates = result.fastbite_templates || [];
            const idx = templates.findIndex(t => t.id === message.template.id);
            if (idx >= 0) templates[idx] = message.template;
            else templates.push(message.template);
            chrome.storage.local.set({ fastbite_templates: templates });
            sendResponse({ saved: true });
        });
        return true;
    }

    if (message.type === 'delete_template') {
        chrome.storage.local.get(['fastbite_templates'], (result) => {
            const templates = (result.fastbite_templates || []).filter(t => t.id !== message.id);
            chrome.storage.local.set({ fastbite_templates: templates });
            sendResponse({ deleted: true });
        });
        return true;
    }
});
