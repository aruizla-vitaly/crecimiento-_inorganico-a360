const N8N_URL = 'https://vitalytech.app.n8n.cloud/webhook/88cf50a6-e66f-4170-b607-652e1670bd84';

// Sesión
let SESSION_ID = localStorage.getItem('v_session');
if (!SESSION_ID) {
    SESSION_ID = "session_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('v_session', SESSION_ID);
}

// Estado
let selectedDept = null;

// Elementos
const deptScreen  = document.getElementById('deptScreen');
const chatScreen  = document.getElementById('chatScreen');
const deptBadge   = document.getElementById('deptBadge');
const changeDeptBtn = document.getElementById('changeDeptBtn');
const chatView    = document.getElementById('chatView');
const loader      = document.getElementById('loader');
const userInput   = document.getElementById('userInput');
const sendBtn     = document.getElementById('sendBtn');

// ── SELECCIÓN DE DEPARTAMENTO ──
document.querySelectorAll('.dept-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        selectDept(btn.dataset.value, btn.querySelector('.dept-name').textContent);
    });
});

changeDeptBtn.addEventListener('click', function() {
    showDeptScreen();
});

function selectDept(value, label) {
    selectedDept = value;
    deptBadge.textContent = label;

    // Limpiar chat y mostrar bienvenida
    chatView.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'assistant-response';
    welcome.innerHTML =
        '<div class="welcome-card">' +
            '<div class="welcome-icon">◈</div>' +
            '<p>Consultando en <strong>' + label + '</strong>. ¿Qué quieres saber?</p>' +
        '</div>';
    chatView.appendChild(welcome);

    // Transición
    deptScreen.classList.add('dept-screen--out');
    setTimeout(function() {
        deptScreen.style.display = 'none';
        deptScreen.classList.remove('dept-screen--out');
        chatScreen.style.display = 'flex';
        userInput.focus();
    }, 280);
}

function showDeptScreen() {
    chatScreen.style.display = 'none';
    deptScreen.style.display = 'flex';
    selectedDept = null;
}

// ── CONSULTA ──
async function sendQuery() {
    const query = userInput.value.trim();
    if (!query || userInput.disabled || !selectedDept) return;

    renderUserMsg(query);
    userInput.value = '';
    toggleState(true);

    try {
        const response = await fetch(N8N_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consulta: query,
                departamento: selectedDept,
                sessionId: SESSION_ID
            })
        });

        if (!response.ok) throw new Error("Error en servidor");

        const rawText = await response.text();
        console.log('[Vitaly] Raw:', rawText);

        const data = parseResponse(rawText);
        renderAssistantResponse(data);
    } catch (e) {
        console.error(e);
        renderError();
    } finally {
        toggleState(false);
    }
}

function parseResponse(text) {
    const trimmed = text.trim();
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        try {
            const lines = trimmed.split('\n').filter(function(l) { return l.trim(); });
            parsed = lines.map(function(l) { return JSON.parse(l.trim()); });
        } catch (e2) {
            console.error('[Vitaly] Parse error:', text);
            return [];
        }
    }
    return normalizeItems(parsed);
}

function normalizeItems(data) {
    if (Array.isArray(data)) {
        if (data.length > 0 && data[0] !== null && typeof data[0] === 'object' && 'json' in data[0]) {
            return data.map(function(d) { return d.json; });
        }
        return data;
    }
    if (data && Array.isArray(data.items))  return data.items;
    if (data && Array.isArray(data.output)) return normalizeItems(data.output);
    if (data && data.json)                  return normalizeItems(data.json);
    if (data && (data.apartado || data.contexto)) return [data];
    return [data];
}

// ── RENDER ──
function renderUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'user-query';
    div.innerText = text;
    chatView.appendChild(div);
    scroll();
}

function renderAssistantResponse(data) {
    const container = document.createElement('div');
    container.className = 'assistant-response';

    const items = data;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="error-msg"><span class="error-icon">⚠</span> No se encontraron resultados para esta consulta.</div>';
        chatView.appendChild(container);
        scroll();
        return;
    }

    const responseHeader = document.createElement('div');
    responseHeader.className = 'response-header';
    responseHeader.innerHTML = '<span class="response-icon">◈</span> Se encontraron <strong>' + items.length + '</strong> resultado' + (items.length !== 1 ? 's' : '');
    container.appendChild(responseHeader);

    items.forEach(function(item, index) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = (index * 0.08) + 's';

        const iconSheet = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>';
        const iconDoc   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

        // 01 Apartado
        const apartadoEl = document.createElement('div');
        apartadoEl.className = 'card-section card-apartado';
        apartadoEl.innerHTML =
            '<span class="section-label"><span class="section-num">01</span> Apartado</span>' +
            '<span class="section-value">' + (item.apartado || 'Sin clasificar') + '</span>';
        card.appendChild(apartadoEl);

        // 02 Contexto
        const contextoEl = document.createElement('div');
        contextoEl.className = 'card-section card-contexto';
        contextoEl.innerHTML =
            '<span class="section-label"><span class="section-num">02</span> Contexto</span>' +
            '<p class="section-body">' + (item.contexto || 'No hay descripción disponible.') + '</p>';
        card.appendChild(contextoEl);

        // 03 Documentos
        if (item.documentos && item.documentos.length > 0) {
            const docsEl = document.createElement('div');
            docsEl.className = 'card-section card-docs';
            const linksHTML = item.documentos.map(function(doc) {
                const icon = doc.url && doc.url.includes('spreadsheets') ? iconSheet : iconDoc;
                return '<a href="' + doc.url + '" target="_blank" class="doc-link">' + icon + '<span>' + doc.nombre + '</span></a>';
            }).join('');
            docsEl.innerHTML =
                '<span class="section-label"><span class="section-num">03</span> Documentos</span>' +
                '<div class="docs-grid">' + linksHTML + '</div>';
            card.appendChild(docsEl);
        }

        const cardIndex = document.createElement('div');
        cardIndex.className = 'card-index';
        cardIndex.textContent = String(index + 1).padStart(2, '0');
        card.appendChild(cardIndex);

        container.appendChild(card);
    });

    chatView.appendChild(container);
    scroll();
}

function toggleState(loading) {
    userInput.disabled = loading;
    sendBtn.disabled = loading;
    loader.style.display = loading ? 'flex' : 'none';
}

function renderError() {
    const div = document.createElement('div');
    div.className = 'error-msg';
    div.innerHTML = '<span class="error-icon">⚠</span> Error de conexión. Revisa los CORS en n8n.';
    chatView.appendChild(div);
    scroll();
}

function scroll() { chatView.scrollTop = chatView.scrollHeight; }

userInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') sendQuery(); });