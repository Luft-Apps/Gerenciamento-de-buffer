const generateBufferPallets = () => {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const rows = [1, 2, 3, 4, 5, 6];
    const pallets = [];
    
    for (let c = 0; c < 12; c++) {
        for (let r = 0; r < 6; r++) {
            pallets.push({ address: `${columns[c]}${rows[r]}`, waves: [] });
        }
    }
    return pallets;
};

const initialBufferPallets = generateBufferPallets();

let currentTheme = 'light';
try {
    const savedTheme = localStorage.getItem('buffer-theme');
    currentTheme = savedTheme === 'dark' || savedTheme === 'light'
        ? savedTheme
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch (_) {}
document.documentElement.dataset.theme = currentTheme;

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = currentTheme;
    try { localStorage.setItem('buffer-theme', currentTheme); } catch (_) {}
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.innerHTML = themeButtonContent();
        button.setAttribute('aria-label', currentTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    }
}

function themeButtonContent() {
    return `<i class="ph ${currentTheme === 'dark' ? 'ph-sun' : 'ph-moon'} text-lg"></i><span>${currentTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>`;
}
let state = {
    activeTab: 'overview',
    currentTime: new Date(),
    appData: {
        bufferPallets: initialBufferPallets
    },
    ui: {
        selectedAddress: null,
        searchBufferText: '',
        modals: {
            palletLookup: { open: false },
            addWave: { open: false, step: 'form', error: '', newWaveId: '', selectedSlot: '' },
            withdraw: { open: false, step: 'form', error: '' },
            editWave: { open: false, oldWaveId: '', currentSlot: '', error: '' },
            reallocate: { open: false, waveId: '', currentSlot: '', error: '' },
            deleteWave: { open: false, waveId: '', currentSlot: '' }
        }
    }
};

const menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: 'ph ph-squares-four' },
    { id: 'buffer', label: 'Mapa do Buffer', icon: 'ph ph-map-trifold' },
];

function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <header class="topbar">
            <div class="topbar-brand">
                <img src="luft.jpg" alt="Logo LUFT Logistics" width="52" height="52">
                <div><strong>LUFT Logistics</strong><small>Gestão de Buffer</small></div>
            </div>
            <nav class="topbar-tabs" aria-label="Navegação principal">
                ${menuItems.map(item => `<button type="button" class="topbar-tab" onclick="changeTab('${item.id}')" ${state.activeTab === item.id ? 'aria-current="page"' : ''}><i class="${item.icon}" aria-hidden="true"></i><span>${item.label}</span></button>`).join('')}
            </nav>
            <div class="topbar-tools">
                <span id="sync-status" role="status" class="text-xs">${storageBusy ? 'Salvando…' : 'Conectado'}</span>
                <button type="button" onclick="logoutBuffer()" class="text-sm">Sair</button>
                <button id="theme-toggle" type="button" onclick="toggleTheme()" aria-label="${currentTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}">${themeButtonContent()}</button>
                <img class="topbar-partner" src="alpargatas.jpg" alt="Logo Alpargatas" width="92" height="50">
            </div>
        </header>
        <main class="app-main bg-slate-50/50">
            <div class="page-heading"><h1>Operação / ${menuItems.find(i => i.id === state.activeTab)?.label || 'Sistema'}</h1><span id="clock-display">${state.currentTime.toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo', hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'})}</span></div>
            <div id="view-container"><div class="view-inner">${getViewContent()}</div></div>
        </main>
    `;
    renderModals();
    if (state.activeTab === 'buffer' && state.ui.searchBufferText) handleSearch(state.ui.searchBufferText, true);
}

function changeTab(tabId) {
    state.activeTab = tabId;
    renderApp();
}

function getViewContent() {
    switch(state.activeTab) {
        case 'overview': return renderOverview();
        case 'buffer': return renderBufferMap();
        default: return renderOverview();
    }
}

function renderOverview() {
    const bufferCapacity = 72; 
    const occupiedPallets = state.appData.bufferPallets.filter(p => p.waves.length > 0);
    const bufferOccupied = occupiedPallets.length;
    const bufferFree = bufferCapacity - bufferOccupied;
    
    const uniqueWaves = new Set();
    occupiedPallets.forEach(p => p.waves.forEach(w => uniqueWaves.add(w.id)));
    const totalUniqueWaves = uniqueWaves.size;

    return `
        <div class="space-y-6 fade-in">
            <!-- KPI Cards -->
            <div class="overview-kpis">
                
                <div class="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-slate-200 flex flex-col justify-between group">
                    <div class="flex items-center space-x-4 mb-2">
                        <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><i class="ph ph-map-trifold text-2xl"></i></div>
                        <div>
                            <p class="text-sm text-slate-500 font-medium">Vagas no Buffer</p>
                            <p class="text-2xl font-black text-slate-800 leading-tight">${bufferOccupied} <span class="text-sm text-slate-400 font-medium">/ 72</span></p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <div class="flex justify-between text-xs font-bold mb-1.5 uppercase tracking-wide">
                            <span class="text-blue-600">Ocupadas</span>
                            <span class="text-green-600">${bufferFree} Livres</span>
                        </div>
                        <div class="w-full bg-green-100/80 rounded-full h-2.5 overflow-hidden flex">
                            <div class="bg-blue-500 h-full rounded-full transition-all duration-1000" style="width: ${(bufferOccupied/bufferCapacity)*100}%"></div>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-slate-200 flex flex-col justify-between group">
                    <div class="flex items-center space-x-4 mb-2">
                        <div class="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><i class="ph ph-package text-2xl"></i></div>
                        <div>
                            <p class="text-sm text-slate-500 font-medium">Paletes no Buffer</p>
                            <p class="text-3xl font-black text-slate-800 leading-tight">${bufferOccupied}</p>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 font-medium bg-slate-50 py-1.5 px-3 rounded-lg inline-block mt-4">Unidades físicas armazenadas</p>
                </div>

                <div class="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-slate-200 flex flex-col justify-between group">
                    <div class="flex items-center space-x-4 mb-2">
                        <div class="p-3 bg-cyan-50 text-cyan-600 rounded-xl group-hover:scale-110 transition-transform"><i class="ph ph-stack text-2xl"></i></div>
                        <div>
                            <p class="text-sm text-slate-500 font-medium">Ondas no Buffer</p>
                            <p class="text-3xl font-black text-slate-800 leading-tight">${totalUniqueWaves}</p>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 font-medium bg-slate-50 py-1.5 px-3 rounded-lg inline-block mt-4">Pedidos únicos aguardando</p>
                </div>
            </div>


        </div>
    `;
}

function renderBufferMap() {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const rows = [1, 2, 3, 4, 5, 6];
    
    const getPallet = (addr) => state.appData.bufferPallets.find(p => p.address === addr);
    const selectedPallet = state.ui.selectedAddress ? getPallet(state.ui.selectedAddress) : null;
    const isSelectedOccupied = selectedPallet && selectedPallet.waves.length > 0;

    return `
        <div class="space-y-6 fade-in flex flex-col h-full relative">
            <div class="buffer-toolbar">
                <div>
                    <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Mapa do Buffer</h2>
                    <p class="text-slate-500 text-sm mt-1 font-medium">Visão esquemática das 72 vagas (A-L / 1-6).</p>
                </div>
                <div class="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <button id="pallet-lookup-button" type="button" onclick="openPalletLookupModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
                        <i class="ph ph-barcode text-lg" aria-hidden="true"></i>
                        <span>Detalhe palete</span>
                    </button>
                    <button onclick="openAddWaveModal()" class="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                        <i class="ph ph-plus font-bold text-lg"></i>
                        <span>Adicionar Onda</span>
                    </button>
                    <div class="relative w-full sm:w-72">
                        <i class="ph ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg"></i>
                        <input type="text" placeholder="Buscar por onda..." 
                               oninput="handleSearch(this.value)" value="${escapeAttribute(state.ui.searchBufferText)}"
                               class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm">
                    </div>
                </div>
            </div>

            <div class="buffer-layout pb-8">
                <!-- Grid Area -->
                <div class="buffer-grid-card bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto pb-2 custom-scrollbar">
                        <div class="buffer-map-inner">
                            <div class="buffer-map-grid mb-2">
                                <div></div>
                                ${columns.map(c => `
                                    <div class="text-center font-bold text-slate-400 text-xs">${c}</div>
                                    ${c === 'G' ? '<div class="text-center font-bold text-amber-600 text-[9px] uppercase tracking-tighter" title="Corredor entre as colunas G e H">Corredor</div>' : ''}
                                `).join('')}
                            </div>
                            <div class="buffer-map-grid">
                                ${rows.map(r => `
                                    <div class="flex items-center justify-center font-bold text-slate-400 text-xs">${r}</div>
                                    ${columns.map(c => {
                                        const addr = `${c}${r}`;
                                        const pallet = getPallet(addr);
                                        const occupied = pallet && pallet.waves.length > 0;
                                        const isSelected = state.ui.selectedAddress === addr;
                                        
                                        let cellClasses = occupied 
                                            ? 'bg-blue-50/50 border-blue-200 hover:border-blue-400 hover:bg-blue-50' 
                                            : 'bg-slate-50 border-slate-200 border-dashed hover:border-slate-400';
                                        
                                        if (isSelected) cellClasses += ' ring-2 ring-blue-500 shadow-md scale-[1.02] z-10';

                                        return `
                                            <div role="button" tabindex="0" aria-label="Ver palete na vaga ${addr}: ${pallet?.waves.length || 0} ondas" onclick="selectBufferSlot('${addr}')" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectBufferSlot('${addr}'); }" id="cell-${addr}" class="buffer-cell relative p-1.5 border rounded-lg flex flex-col h-[88px] cursor-pointer transition-all duration-200 ${cellClasses}">
                                                <div class="flex justify-between items-start mb-1.5">
                                                    <span class="font-bold text-[11px] ${occupied ? 'text-blue-900' : 'text-slate-400'}">${addr}</span>
                                                    ${occupied ? `<span class="text-[9px] font-bold px-1 rounded-sm ${pallet.waves.length === 4 ? 'bg-orange-100 text-orange-700' : 'bg-blue-200 text-blue-800'}">${pallet.waves.length}/4</span>` : ''}
                                                </div>
                                                ${occupied ? `
                                                    <div class="flex flex-col gap-[3px] overflow-hidden">
                                                        ${pallet.waves.map(w => {
                                                            let priorityClass = 'bg-white border-blue-100 text-slate-600';
                                                            if (w.priority === 'Urgente') priorityClass = 'bg-red-100 border-red-500 text-red-900 font-bold shadow-sm shadow-red-200';
                                                            return `<span class="wave-tag text-[9px] px-1 py-[2px] rounded truncate leading-none font-medium border ${priorityClass}" data-wave="${w.id}">${w.id}</span>`;
                                                        }).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                            ${c === 'G' ? `<div class="h-[88px] rounded-md bg-amber-50/80 border-x-2 border-dashed border-amber-300 flex items-center justify-center" title="Corredor entre G e H"><i class="ph ph-arrows-left-right text-amber-400 text-sm"></i></div>` : ''}
                                        `;
                                    }).join('')}
                                    ${r === 2 || r === 4 ? `
                                        <div class="col-span-full h-8 rounded-md bg-amber-50/80 border-y-2 border-dashed border-amber-300 flex items-center justify-center gap-2 text-amber-600" title="Corredor entre as linhas ${r} e ${r + 1}">
                                            <i class="ph ph-arrows-down-up text-sm"></i>
                                            <span class="text-[9px] font-bold uppercase tracking-wider">Corredor</span>
                                        </div>
                                    ` : ''}
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Visualização rápida do palete -->
                ${state.ui.selectedAddress ? `
                    <dialog id="pallet-dialog" aria-labelledby="pallet-dialog-title" class="pallet-dialog bg-white border border-slate-200 rounded-2xl shadow-xl" oncancel="event.preventDefault(); selectBufferSlot(null)" onclick="if(event.target === this) selectBufferSlot(null)">
                        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h3 id="pallet-dialog-title" class="font-bold text-slate-800 flex items-center text-lg">
                                <i class="ph ph-map-trifold mr-2 text-blue-600 text-lg"></i> Vaga ${state.ui.selectedAddress}
                            </h3>
                            <button type="button" aria-label="Fechar detalhes do palete" onclick="selectBufferSlot(null)" class="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 transition-colors">
                                <i class="ph ph-x"></i>
                            </button>
                        </div>
                        <div class="p-5 flex-1 overflow-y-auto">
                            ${isSelectedOccupied ? `
                                <div class="space-y-4">
                                    <div class="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <div class="flex items-center text-blue-800">
                                            <i class="ph ph-package mr-2 text-lg"></i>
                                            <span class="font-semibold text-sm">Palete Ocupado</span>
                                        </div>
                                        <span class="text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded-full shadow-sm">
                                            ${selectedPallet.waves.length} de 4 Ondas
                                        </span>
                                    </div>
                                    <div class="space-y-3 pt-2" id="pallet-waves-details">
                                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ondas Alocadas</h4>
                                        ${selectedPallet.waves.map((w) => {
                                            let indicatorColor = w.priority === 'Urgente' ? 'bg-red-600 animate-pulse' : 'bg-blue-500';
                                            let cardClass = w.priority === 'Urgente' ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white';

                                            let originTags = [];
                                            if (w.origin?.picking) originTags.push('<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Picking</span>');
                                            if (w.origin?.pulmao) originTags.push('<span class="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">Pulmão</span>');

                                            const otherPallets = state.appData.bufferPallets
                                                .filter(p => p.address !== selectedPallet.address && p.waves.some(ow => ow.id === w.id))
                                                .map(p => p.address);

                                            let continuationHtml = '';
                                            if (otherPallets.length > 0) {
                                                continuationHtml = `
                                                    <div class="mt-2 bg-indigo-50 border border-indigo-100 rounded p-2 text-xs">
                                                        <span class="font-semibold text-indigo-800 flex items-center mb-1">
                                                            <i class="ph ph-link mr-1 text-sm"></i> Continuação / Divisão
                                                        </span>
                                                        <span class="text-indigo-600">Também presente na(s) vaga(s): <span class="font-bold">${otherPallets.join(', ')}</span></span>
                                                    </div>
                                                `;
                                            }

                                            return `
                                            <div class="wave-detail-card relative border ${cardClass} rounded-lg p-3 overflow-hidden transition-colors" data-wave="${w.id}">
                                                <div class="wave-indicator absolute top-0 left-0 w-1 h-full ${indicatorColor}"></div>
                                                <div class="pl-2">
                                                    <div class="flex justify-between items-start mb-2">
                                                        <h4 class="wave-id-text font-bold ${w.priority === 'Urgente' ? 'text-red-900' : 'text-slate-800'}">${w.id}</h4>
                                                        ${w.priority === 'Urgente' ? `<span class="flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white shadow-sm"><i class="ph ph-warning-circle mr-1 text-xs"></i> PRIORIDADE</span>` : ''}
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <div class="flex items-center text-[10px] space-x-1 mb-1">
                                                            <span class="text-slate-500 font-medium">Origem:</span>
                                                            ${originTags.join(' ')}
                                                        </div>
                                                        <div class="flex items-center text-xs text-slate-500">
                                                            <i class="ph ph-clock mr-2 text-slate-400"></i> <span>Alocado às: <span class="font-medium text-slate-700">${w.time}</span></span>
                                                        </div>
                                                    </div>
                                                    ${continuationHtml}
                                                    <div class="mt-3 pt-2 border-t border-slate-100 flex justify-end flex-wrap gap-2">
                                                        <button onclick="openEditWaveModal('${w.id}', '${selectedPallet.address}')" class="text-[11px] px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center font-medium transition"><i class="ph ph-pencil-simple mr-1"></i> Editar</button>
                                                        <button onclick="openReallocateModal('${w.id}', '${selectedPallet.address}')" class="text-[11px] px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded flex items-center font-medium transition"><i class="ph ph-arrows-left-right mr-1"></i> Realocar</button>
                                                        <button onclick="openDeleteWaveModal('${w.id}', '${selectedPallet.address}')" class="text-[11px] px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded flex items-center font-medium transition"><i class="ph ph-trash mr-1"></i> Excluir</button>
                                                    </div>
                                                </div>
                                            </div>
                                            `;
                                        }).join('')}
                                    </div>
                                    <div class="pt-4 border-t border-slate-100 mt-4">
                                        <button onclick="openWithdrawModal()" class="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm">
                                            <i class="ph ph-sign-out text-lg"></i>
                                            <span>Retirar do Buffer</span>
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <div class="text-center py-12 text-slate-400 flex flex-col items-center">
                                    <div class="w-16 h-16 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4">
                                        <i class="ph ph-check-circle text-2xl text-slate-300"></i>
                                    </div>
                                    <p class="font-semibold text-slate-600 text-base">Vaga Livre</p>
                                    <p class="text-sm mt-1 max-w-[200px]">Nenhum palete alocado neste endereço no momento.</p>
                                </div>
                            `}
                        </div>
                    </dialog>
                ` : ''}
            </div>
        </div>
    `;
}

function checkWaveContinuation(val) {
    const waveId = val.trim().toUpperCase();
    const warningEl = document.getElementById('continuation-warning');
    if (warningEl) {
        if (!waveId) {
            warningEl.classList.add('hidden');
            return;
        }
        const exists = state.appData.bufferPallets.some(p => p.waves.some(w => w.id === waveId));
        if (exists) {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }
}

function renderModals() {
    const modalsDiv = document.getElementById('modals');
    let html = '';

    if (state.ui.modals.palletLookup.open) {
        html += `
            <dialog id="pallet-lookup-dialog" class="pallet-dialog bg-white border border-slate-200 rounded-2xl shadow-xl" aria-labelledby="pallet-lookup-title" oncancel="event.preventDefault(); closeModal('palletLookup')" onclick="if(event.target === this) closeModal('palletLookup')">
                <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 id="pallet-lookup-title" class="font-bold text-slate-800 text-lg">Detalhe palete</h3>
                    <button type="button" aria-label="Fechar busca do palete" onclick="closeModal('palletLookup')" class="p-2 text-slate-500"><i class="ph ph-x text-lg" aria-hidden="true"></i></button>
                </div>
                <form onsubmit="handlePalletLookup(event)" class="p-5 space-y-4">
                    <p class="text-sm text-slate-600">Digite ou bipe a etiqueta da vaga para visualizar o palete.</p>
                    <div>
                        <label for="pallet-lookup-input" class="block text-sm font-semibold text-slate-700 mb-2">Etiqueta / endereço da vaga</label>
                        <input id="pallet-lookup-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" autofocus placeholder="Ex.: A1 ou L6" aria-describedby="pallet-lookup-error" class="w-full p-3 border border-slate-300 rounded-lg text-lg uppercase focus:ring-2 focus:ring-blue-500" required>
                    </div>
                    <p id="pallet-lookup-error" role="alert" class="text-sm text-red-600"></p>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold">Ver palete</button>
                </form>
            </dialog>`;
    }

    // Add Wave Modal
    if (state.ui.modals.addWave.open) {
        const step = state.ui.modals.addWave.step;
        const err = state.ui.modals.addWave.error;

        html += `
            <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 class="font-bold text-slate-800 flex items-center"><i class="ph ph-plus mr-2 text-blue-600"></i> Adicionar Nova Onda</h3>
                        <button onclick="closeModal('addWave')" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
                    </div>
                    ${step === 'form' ? `
                        <div class="p-6">
                            ${err ? `<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start"><i class="ph ph-warning mr-2 mt-0.5"></i><span>${err}</span></div>` : ''}
                            <form onsubmit="handleAddWaveSubmit(event)" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-slate-700 mb-1">Número da Onda</label>
                                    <input type="text" id="form-wave-id" oninput="checkWaveContinuation(this.value)" placeholder="Ex: 3200000" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" required>
                                    
                                    <!-- Aviso de Continuação Dinâmico -->
                                    <div id="continuation-warning" class="hidden mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start text-blue-700 text-sm">
                                        <i class="ph ph-info mr-2 mt-0.5 text-lg"></i>
                                        <div><span class="font-bold">Atenção:</span> Esta onda já possui partes no buffer. Será uma <b>continuação</b>.</div>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-slate-700 mb-1">Endereço (Vaga no Buffer)</label>
                                    <input type="text" id="form-wave-slot" placeholder="BiPe ou digite a vaga (ex: A1, L6)" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-bold" required>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-slate-700 mb-2">Prioridade</label>
                                        <label class="flex items-center space-x-2 cursor-pointer bg-red-50 border border-red-100 p-2 rounded-lg">
                                            <input type="checkbox" id="form-wave-urgent" class="w-4 h-4 text-red-600 rounded focus:ring-red-500">
                                            <span class="text-sm font-bold text-red-700 flex items-center">Prioridade</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-slate-700 mb-2">Origem dos itens</label>
                                        <div class="flex space-x-3">
                                            <label class="flex items-center space-x-1.5 cursor-pointer">
                                                <input type="checkbox" id="form-wave-picking" class="w-4 h-4 text-blue-600 rounded" checked>
                                                <span class="text-sm text-slate-600">Picking</span>
                                            </label>
                                            <label class="flex items-center space-x-1.5 cursor-pointer">
                                                <input type="checkbox" id="form-wave-pulmao" class="w-4 h-4 text-blue-600 rounded">
                                                <span class="text-sm text-slate-600">Pulmão</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="pt-4 flex justify-end space-x-3">
                                    <button type="button" onclick="closeModal('addWave')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                    <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm">Confirmar</button>
                                </div>
                            </form>
                        </div>
                    ` : `
                        <div class="p-8 flex flex-col items-center text-center">
                            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><i class="ph ph-check-circle text-3xl"></i></div>
                            <h3 class="text-xl font-bold text-slate-800 mb-2">Onda Adicionada!</h3>
                            <p class="text-slate-600 mb-6">A onda foi alocada com sucesso no palete.</p>
                            <button onclick="closeModal('addWave')" class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg">Concluir e Fechar</button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Withdraw Modal
    if (state.ui.modals.withdraw.open) {
        const step = state.ui.modals.withdraw.step;
        const addr = state.ui.selectedAddress;
        const pallet = state.appData.bufferPallets.find(p => p.address === addr);

        html += `
            <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                        <h3 class="font-bold text-slate-800 flex items-center"><i class="ph ph-sign-out mr-2 text-purple-600"></i> Retirar Palete</h3>
                        <button onclick="closeModal('withdraw')" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
                    </div>
                    ${step === 'form' ? `
                        <div class="p-6">
                            <div class="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                                <p class="text-sm text-slate-600 mb-1">Palete de origem:</p>
                                <p class="font-bold text-slate-800 text-xl">Vaga ${addr}</p>
                                <p class="text-xs text-slate-500 mt-1">Contém ${pallet?.waves.length} onda(s)</p>
                            </div>
                            <form onsubmit="handleWithdrawSubmit(event)">
                                <div class="pt-4 flex justify-end space-x-3">
                                    <button type="button" onclick="closeModal('withdraw')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                    <button type="submit" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm">Confirmar Retirada</button>
                                </div>
                            </form>
                        </div>
                    ` : `
                        <div class="p-8 flex flex-col items-center text-center">
                            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><i class="ph ph-check-circle text-3xl"></i></div>
                            <h3 class="text-xl font-bold text-slate-800 mb-2">Palete Retirado!</h3>
                            <p class="text-slate-600 mb-6">Palete retirado com sucesso. Vaga livre.</p>
                            <button onclick="closeModal('withdraw'); selectBufferSlot(null);" class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg">Concluir e Fechar</button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Edit Wave Modal
    if (state.ui.modals.editWave.open) {
        const err = state.ui.modals.editWave.error;
        html += `
            <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 class="font-bold text-slate-800 flex items-center"><i class="ph ph-pencil-simple mr-2 text-slate-600"></i> Editar Onda</h3>
                        <button onclick="closeModal('editWave')" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
                    </div>
                    <div class="p-6">
                        ${err ? `<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start"><i class="ph ph-warning mr-2 mt-0.5"></i><span>${err}</span></div>` : ''}
                        <p class="text-sm text-slate-500 mb-4">Atenção: Renomear a onda atualizará todas as vagas caso ela seja uma continuação.</p>
                        <form onsubmit="handleEditWaveSubmit(event)">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Novo número da onda</label>
                            <input type="text" id="form-edit-wave-id" value="${state.ui.modals.editWave.oldWaveId}" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase" required>
                            
                            <div class="pt-6 flex justify-end space-x-3">
                                <button type="button" onclick="closeModal('editWave')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm">Salvar Alteração</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // Reallocate Wave Modal
    if (state.ui.modals.reallocate.open) {
        const err = state.ui.modals.reallocate.error;
        html += `
            <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                        <h3 class="font-bold text-slate-800 flex items-center"><i class="ph ph-arrows-left-right mr-2 text-blue-600"></i> Realocar Onda</h3>
                        <button onclick="closeModal('reallocate')" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
                    </div>
                    <div class="p-6">
                        ${err ? `<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start"><i class="ph ph-warning mr-2 mt-0.5"></i><span>${err}</span></div>` : ''}
                        <div class="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <span class="text-xs text-slate-500 block mb-1">Movendo onda:</span>
                            <span class="font-bold text-slate-800">${state.ui.modals.reallocate.waveId}</span>
                            <span class="text-xs text-slate-500 block mt-1">Vaga atual: <span class="font-bold text-slate-700">${state.ui.modals.reallocate.currentSlot}</span></span>
                        </div>
                        <form onsubmit="handleReallocateSubmit(event)">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Nova Vaga Destino</label>
                            <input type="text" id="form-reallocate-slot" placeholder="BiPe ou digite (ex: C4)" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-bold" required>
                            
                            <div class="pt-6 flex justify-end space-x-3">
                                <button type="button" onclick="closeModal('reallocate')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // Delete Wave Modal
    if (state.ui.modals.deleteWave.open) {
        html += `
            <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
                        <h3 class="font-bold text-slate-800 flex items-center"><i class="ph ph-warning-circle mr-2 text-red-600"></i> Excluir Onda</h3>
                        <button onclick="closeModal('deleteWave')" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
                    </div>
                    <div class="p-6">
                        <p class="text-sm text-slate-600 mb-4">Tem certeza que deseja remover a onda <strong class="text-slate-800">${state.ui.modals.deleteWave.waveId}</strong> da vaga <strong class="text-slate-800">${state.ui.modals.deleteWave.currentSlot}</strong>?</p>
                        <p class="text-xs text-red-600 mb-6 bg-red-50 p-3 rounded-lg border border-red-100">Esta ação removerá a onda deste palete.</p>
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="closeModal('deleteWave')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            <button onclick="handleDeleteWaveSubmit()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow-sm">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    modalsDiv.innerHTML = html;
    syncPalletDialog();
    const lookupDialog = document.getElementById('pallet-lookup-dialog');
    if (state.ui.modals.palletLookup.open && lookupDialog && !lookupDialog.open) lookupDialog.showModal();
}

function openPalletLookupModal() {
    state.ui.modals.palletLookup.open = true;
    renderModals();
}

function handlePalletLookup(event) {
    event.preventDefault();
    const input = document.getElementById('pallet-lookup-input');
    const address = input.value.trim().toUpperCase();
    const error = document.getElementById('pallet-lookup-error');
    if (!/^[A-L][1-6]$/.test(address) || !state.appData.bufferPallets.some(p => p.address === address)) {
        error.textContent = 'Vaga não encontrada. Informe um endereço de A1 a L6.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        input.select();
        return;
    }
    state.ui.modals.palletLookup.open = false;
    selectBufferSlot(address);
}

function syncPalletDialog() {
    const dialog = document.getElementById('pallet-dialog');
    if (!dialog) return;
    const operationOpen = Object.values(state.ui.modals).some(modal => modal.open);
    if (operationOpen && dialog.open) dialog.close();
    if (!operationOpen && !dialog.open) dialog.showModal();
}

function selectBufferSlot(addr) {
    const previousAddress = state.ui.selectedAddress;
    state.ui.selectedAddress = addr;
    renderApp();
    if(state.ui.searchBufferText) handleSearch(state.ui.searchBufferText, true);
    if (!addr && previousAddress) document.getElementById(`cell-${previousAddress}`)?.focus();
}

function handleSearch(term, force = false) {
    if(!force) state.ui.searchBufferText = term;
    const searchTerm = state.ui.searchBufferText.trim().toLowerCase();
    const matchingPallets = [];
    
    document.querySelectorAll('.buffer-cell').forEach(c => c.classList.remove('search-match'));
    document.querySelectorAll('.wave-tag, .wave-detail-card').forEach(tag => {
        tag.classList.remove('search-match-wave');
        if(tag.classList.contains('wave-detail-card')) {
            tag.classList.replace('border-yellow-400', 'border-slate-200');
            tag.classList.replace('bg-yellow-50', 'bg-white');
        }
    });

    if(!searchTerm) return;
    state.appData.bufferPallets.forEach(pallet => {
        const matchWaves = pallet.waves.filter(w => w.id.toLowerCase().includes(searchTerm));
        if(matchWaves.length > 0) {
            const cell = document.getElementById(`cell-${pallet.address}`);
            if(cell) cell.classList.add('search-match');
            if (cell) matchingPallets.push({ cell, exact: matchWaves.some(w => w.id.toLowerCase() === searchTerm) });
            matchWaves.forEach(w => {
                if(cell) cell.querySelectorAll(`[data-wave="${w.id}"]`).forEach(t => t.classList.add('search-match-wave'));
                if (state.ui.selectedAddress === pallet.address) {
                    const detailsCard = document.querySelector(`.wave-detail-card[data-wave="${w.id}"]`);
                    if(detailsCard) {
                        detailsCard.classList.replace('border-slate-200', 'border-yellow-400');
                        detailsCard.classList.replace('bg-white', 'bg-yellow-50');
                    }
                }
            });
        }
    });
    if (!force && matchingPallets.length > 0) {
        const target = matchingPallets.find(match => match.exact) || matchingPallets[0];
        target.cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

function openAddWaveModal() {
    state.ui.modals.addWave = { open: true, step: 'form', error: '', newWaveId: '', selectedSlot: '' };
    renderModals();
}

function openWithdrawModal() {
    state.ui.modals.withdraw = { open: true, step: 'form', error: '' };
    renderModals();
}

function closeModal(modalName) {
    state.ui.modals[modalName].open = false;
    renderModals();
    if (modalName === 'palletLookup') document.getElementById('pallet-lookup-button')?.focus();
}

function handleAddWaveSubmit(e) {
    e.preventDefault();
    const waveId = document.getElementById('form-wave-id').value.trim().toUpperCase();
    const slot = document.getElementById('form-wave-slot').value.trim().toUpperCase();
    const isUrgent = document.getElementById('form-wave-urgent').checked;
    const priority = isUrgent ? 'Urgente' : 'Normal';
    const hasPicking = document.getElementById('form-wave-picking').checked;
    const hasPulmao = document.getElementById('form-wave-pulmao').checked;

    if (!isValidWaveId(waveId)) {
        state.ui.modals.addWave.error = 'Use até 64 caracteres: letras, números, ponto, barra, hífen ou sublinhado.';
        renderModals();
        return;
    }
    if (!/^[A-L][1-6]$/.test(slot)) {
        state.ui.modals.addWave.error = 'Vaga inválida. Use Letra (A-L) + Número (1-6). Ex: A1, L6.';
        renderModals();
        return;
    }
    if (!hasPicking && !hasPulmao) {
        state.ui.modals.addWave.error = 'Selecione pelo menos uma origem (Picking ou Pulmão).';
        renderModals();
        return;
    }

    const palletIndex = state.appData.bufferPallets.findIndex(p => p.address === slot);
    if (palletIndex === -1) {
        state.ui.modals.addWave.error = 'Vaga não encontrada no layout.';
        renderModals();
        return;
    }

    if (state.appData.bufferPallets[palletIndex].waves.some(w => w.id === waveId)) {
        state.ui.modals.addWave.error = 'Esta onda já está nesta vaga. Para uma continuação, escolha outra vaga.';
        renderModals();
        return;
    }

    if (state.appData.bufferPallets[palletIndex].waves.length >= 4) {
        state.ui.modals.addWave.error = 'Capacidade máxima do palete (4 ondas) atingida.';
        renderModals();
        return;
    }

    const newWave = { 
        id: waveId, priority, origin: { picking: hasPicking, pulmao: hasPulmao },
        time: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    };

    state.appData.bufferPallets[palletIndex].waves.push(newWave);
    

    state.ui.modals.addWave.step = 'success';
    state.ui.selectedAddress = slot;
    renderApp(); 
}

function handleWithdrawSubmit(e) {
    e.preventDefault();
    const addr = state.ui.selectedAddress;
    const palletIdx = state.appData.bufferPallets.findIndex(p => p.address === addr);
    if(palletIdx === -1) return;

    const pallet = state.appData.bufferPallets[palletIdx];
    
    state.appData.bufferPallets[palletIdx].waves = [];
    state.ui.modals.withdraw.step = 'success';
    renderApp();
}

function openEditWaveModal(waveId, currentSlot) {
    state.ui.modals.editWave = { open: true, oldWaveId: waveId, currentSlot: currentSlot, error: '' };
    renderModals();
}

function openReallocateModal(waveId, currentSlot) {
    state.ui.modals.reallocate = { open: true, waveId: waveId, currentSlot: currentSlot, error: '' };
    renderModals();
}

function openDeleteWaveModal(waveId, currentSlot) {
    state.ui.modals.deleteWave = { open: true, waveId: waveId, currentSlot: currentSlot };
    renderModals();
}

function handleEditWaveSubmit(e) {
    e.preventDefault();
    const oldId = state.ui.modals.editWave.oldWaveId;
    const newId = document.getElementById('form-edit-wave-id').value.trim().toUpperCase();

    if (newId === oldId) {
        closeModal('editWave');
        return;
    }

    if (!isValidWaveId(newId)) {
        state.ui.modals.editWave.error = 'Use até 64 caracteres: letras, números, ponto, barra, hífen ou sublinhado.';
        renderModals();
        return;
    }
    if (state.appData.bufferPallets.some(p => p.waves.some(w => w.id === newId))) {
        state.ui.modals.editWave.error = 'Já existe uma onda com esse número no buffer.';
        renderModals();
        return;
    }

    // Renomeia todas as partes da onda no buffer.
    state.appData.bufferPallets.forEach(p => {
        p.waves.forEach(w => {
            if (w.id === oldId) w.id = newId;
        });
    });

    closeModal('editWave');
    renderApp();
}

function handleReallocateSubmit(e) {
    e.preventDefault();
    const waveId = state.ui.modals.reallocate.waveId;
    const oldSlot = state.ui.modals.reallocate.currentSlot;
    const newSlot = document.getElementById('form-reallocate-slot').value.trim().toUpperCase();

    if (!/^[A-L][1-6]$/.test(newSlot)) {
        state.ui.modals.reallocate.error = 'Vaga inválida. Use Letra (A-L) + Número (1-6).';
        renderModals();
        return;
    }

    if (newSlot === oldSlot) {
        state.ui.modals.reallocate.error = 'A vaga destino é a mesma que a atual.';
        renderModals();
        return;
    }

    const destPalletIdx = state.appData.bufferPallets.findIndex(p => p.address === newSlot);
    if (destPalletIdx === -1) return;

    if (state.appData.bufferPallets[destPalletIdx].waves.some(w => w.id === waveId)) {
        state.ui.modals.reallocate.error = 'Esta onda já está na vaga destino. Escolha outra vaga.';
        renderModals();
        return;
    }

    if (state.appData.bufferPallets[destPalletIdx].waves.length >= 4) {
        state.ui.modals.reallocate.error = 'A vaga destino já atingiu o limite máximo de 4 ondas.';
        renderModals();
        return;
    }

    // Find and remove wave from old pallet
    const oldPalletIdx = state.appData.bufferPallets.findIndex(p => p.address === oldSlot);
    if (oldPalletIdx === -1) return;
    const waveIndex = state.appData.bufferPallets[oldPalletIdx].waves.findIndex(w => w.id === waveId);
    
    if(waveIndex > -1) {
        const waveToMove = state.appData.bufferPallets[oldPalletIdx].waves.splice(waveIndex, 1)[0];
        state.appData.bufferPallets[destPalletIdx].waves.push(waveToMove);

    }

    // If old pallet is now empty, switch focus to new slot to show result
    if (state.ui.selectedAddress === oldSlot && state.appData.bufferPallets[oldPalletIdx].waves.length === 0) {
        state.ui.selectedAddress = newSlot;
    }

    closeModal('reallocate');
    renderApp();
}

function handleDeleteWaveSubmit() {
    const waveId = state.ui.modals.deleteWave.waveId;
    const slot = state.ui.modals.deleteWave.currentSlot;

    const palletIdx = state.appData.bufferPallets.findIndex(p => p.address === slot);
    if (palletIdx > -1) {
        const waveIndex = state.appData.bufferPallets[palletIdx].waves.findIndex(w => w.id === waveId);
        if (waveIndex > -1) {
            state.appData.bufferPallets[palletIdx].waves.splice(waveIndex, 1);
            
        }
    }

    closeModal('deleteWave');
    renderApp();
}


    
function isValidWaveId(value) {
    return /^[A-Z0-9][A-Z0-9._/-]{0,63}$/.test(value);
}

let storageReady = false;
let storageBusy = false;
let bufferRevision = 0;
let bufferUser = null;
let refreshTimer = null;

function renderLogin(message = '') {
    storageReady = false;
    document.getElementById('modals').innerHTML = '';
    document.getElementById('app').innerHTML = `
        <main class="login-page">
            <form class="login-card" onsubmit="loginBuffer(event)">
                <img src="luft.jpg" alt="LUFT Logistics" width="72" height="72">
                <h1>Gestão de Buffer</h1>
                <p>Entre com seu usuário e senha.</p>
                <label for="login-user">Usuário</label>
                <input id="login-user" name="username" autocomplete="username" required placeholder="Seu usuário" autocapitalize="none" spellcheck="false">
                <label for="login-password">Senha</label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required>
                <p id="login-error" role="alert">${escapeAttribute(message)}</p>
                <button id="login-submit" type="submit">Entrar</button>
            </form>
        </main>`;
}

async function loadCloudBuffer() {
    const { data, error } = await BufferSupabase.getClient().from('buffer_state').select('pallets,revision').eq('id', 1).single();
    if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
            throw new Error('Login confirmado, mas o banco do buffer ainda não foi configurado. Execute supabase-setup.sql no SQL Editor.');
        }
        if (error.code === 'PGRST116' || error.code === '42501') {
            throw new Error('Login confirmado, mas o banco não liberou o acesso ao buffer. Execute supabase-access.sql no SQL Editor; se o buffer ainda não foi criado, execute supabase-setup.sql.');
        }
        throw new Error('Login confirmado, mas não foi possível carregar o buffer. Verifique a conexão e tente novamente.');
    }
    const pallets = BufferStorage.validate(data.pallets);
    state.appData.bufferPallets = pallets;
    bufferRevision = data.revision;
}

async function enterBuffer(user) {
    bufferUser = user;
    await loadCloudBuffer();
    storageReady = true;
    state.ui.selectedAddress = null;
    Object.values(state.ui.modals).forEach(modal => { modal.open = false; });
    renderApp();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshCloudBuffer, 15000);
}

async function refreshCloudBuffer() {
    if (!storageReady || storageBusy || Object.values(state.ui.modals).some(modal => modal.open)) return;
    storageBusy = true;
    try {
        const previous = bufferRevision;
        await loadCloudBuffer();
        if (!storageReady) return;
        if (bufferRevision !== previous) renderApp();
        const status = document.getElementById('sync-status');
        if (status) status.textContent = 'Conectado';
    } catch (_) {
        const status = document.getElementById('sync-status');
        if (status) status.textContent = 'Sem conexão';
    } finally { storageBusy = false; }
}

async function loginBuffer(event) {
    event.preventDefault();
    const username = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const button = document.getElementById('login-submit');
    const errorLabel = document.getElementById('login-error');
    button.disabled = true;
    button.textContent = 'Entrando…';
    errorLabel.textContent = '';
    try {
        if (!/^[a-z0-9._-]{1,64}$/.test(username) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
            throw new Error('Informe o nome de usuário ou o identificador completo cadastrado no Supabase.');
        }
        const email = username.includes('@') ? username : `${username}@buffer.invalid`;
        const { data, error } = await BufferSupabase.getClient().auth.signInWithPassword({ email, password });
        if (error) throw new Error(loginErrorMessage(error));
        await enterBuffer(data.user);
    } catch (error) {
        errorLabel.textContent = error.message;
        button.disabled = false;
        button.textContent = 'Entrar';
    }
}

function loginErrorMessage(error) {
    if (error.code === 'email_not_confirmed') {
        return 'A conta ainda não foi confirmada. No Supabase, confirme o usuário em Authentication → Users; ao criar a conta, marque Auto Confirm User.';
    }
    if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message || '')) {
        return 'Usuário ou senha não correspondem à conta cadastrada. Um nome como felipe usa felipe@buffer.invalid; se cadastrou outro identificador, informe-o completo.';
    }
    if (error.status === 429 || error.code === 'over_request_rate_limit') {
        return 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
    }
    if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message || '')) {
        return 'Não foi possível conectar ao Supabase. Verifique a internet e tente novamente.';
    }
    return `Não foi possível entrar. ${error.message || 'Tente novamente.'}`;
}

async function logoutBuffer() {
    if (storageBusy) return;
    clearInterval(refreshTimer);
    storageReady = false;
    bufferUser = null;
    state.appData.bufferPallets = generateBufferPallets();
    renderLogin();
    const { error } = await BufferSupabase.getClient().auth.signOut({ scope: 'local' });
    if (error) document.getElementById('login-error').textContent = 'Não foi possível encerrar a sessão. Verifique a conexão e tente entrar e sair novamente.';
}

function persistOperation(original, isWithdrawal = false) {
    return async function (...args) {
        args[0]?.preventDefault?.();
        if (storageBusy) return;
        if (!storageReady) {
            alert('Entre na sua conta para acessar o buffer.');
            return;
        }
        const before = JSON.stringify(state.appData.bufferPallets);
        const uiBefore = JSON.stringify(state.ui);
        const withdrawalAddress = isWithdrawal ? state.ui.selectedAddress : null;
        original.apply(this, args);
        if (before === JSON.stringify(state.appData.bufferPallets)) return;
        storageBusy = true;
        document.getElementById('app').inert = true;
        document.getElementById('modals').inert = true;
        document.getElementById('sync-status').textContent = 'Salvando…';
        try {
            const { data, error } = await BufferSupabase.getClient().rpc('buffer_commit', {
                p_pallets: BufferStorage.validate(state.appData.bufferPallets),
                p_revision: bufferRevision,
                p_withdraw_address: withdrawalAddress
            });
            if (error) throw error;
            bufferRevision = data;
        } catch (error) {
            state.appData.bufferPallets = JSON.parse(before);
            state.ui = JSON.parse(uiBefore);
            // Releitura resolve conflitos e respostas perdidas após uma gravação bem-sucedida.
            try { await loadCloudBuffer(); } catch (_) {}
            alert(error.message?.includes('BUFFER_CONFLICT')
                ? 'Outra pessoa alterou o buffer. Os dados foram atualizados; confira a vaga e tente novamente.'
                : 'Não foi possível confirmar a gravação. Confira os dados e a conexão antes de tentar novamente.');
        } finally {
            storageBusy = false;
            document.getElementById('app').inert = false;
            document.getElementById('modals').inert = false;
            if (storageReady) renderApp();
        }
    };
}

handleAddWaveSubmit = persistOperation(handleAddWaveSubmit);
handleWithdrawSubmit = persistOperation(handleWithdrawSubmit, true);
handleEditWaveSubmit = persistOperation(handleEditWaveSubmit);
handleReallocateSubmit = persistOperation(handleReallocateSubmit);
handleDeleteWaveSubmit = persistOperation(handleDeleteWaveSubmit);

async function initializeApp() {
    renderLogin();
    try {
        const client = BufferSupabase.getClient();
        client.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                clearInterval(refreshTimer);
                bufferUser = null;
                renderLogin();
            }
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) await enterBuffer(data.session.user);
    } catch (error) {
        renderLogin(error.message);
    }
}

initializeApp();
setInterval(() => {
    state.currentTime = new Date();
    const clock = document.getElementById('clock-display');
    if (clock) clock.textContent = state.currentTime.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}, 60000);
