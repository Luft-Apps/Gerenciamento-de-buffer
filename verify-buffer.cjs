const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', value: '', inert: false, dataset: {}, setAttribute() {} });
    return elements.get(id);
};
let commit;
let remote;
let rpcError;
let login;
const alerts = [];
const client = {
    auth: {
        onAuthStateChange() {},
        async getSession() { return { data: { session: null } }; },
        async signInWithPassword(credentials) { login = credentials; return { data: { user: { id: 'test' } } }; }
    },
    from() { return { select() { return { eq() { return { async single() { return { data: remote }; } }; } }; } }; },
    async rpc(name, payload) { commit = { name, payload }; return { data: 1, error: rpcError }; }
};
const context = vm.createContext({
    console, Date, JSON, Set, BufferSupabase: { getClient: () => client },
    document: { documentElement: { dataset: {} }, getElementById: element },
    window: {}, localStorage: { getItem() { return null; } },
    alert: message => alerts.push(message), setInterval() { return 1; }, clearInterval() {}
});
vm.runInContext(fs.readFileSync('storage.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
vm.runInContext('renderApp = () => {}; renderModals = () => {};', context);

(async () => {
    assert.match(element('app').innerHTML, /login-password/);
    vm.runInContext(`state.appData.bufferPallets[0].waves = [{id:'TEST',priority:'Normal',origin:{picking:true,pulmao:false},time:'04/10/2026, 10:00'}]; state.ui.selectedAddress = 'A1'; storageReady = true;`, context);
    await vm.runInContext('handleWithdrawSubmit({preventDefault(){}})', context);
    assert.equal(commit.name, 'buffer_commit');
    assert.equal(commit.payload.p_withdraw_address, 'A1');
    assert.equal(commit.payload.p_revision, 0);
    assert.equal(commit.payload.p_pallets[0].waves.length, 0);
    assert.equal(vm.runInContext('bufferRevision', context), 1);
    assert.equal(element('app').inert, false);

    commit = null;
    vm.runInContext('storageReady = false', context);
    await vm.runInContext('handleWithdrawSubmit({preventDefault(){}})', context);
    assert.equal(commit, null, 'Unauthenticated operations must not write');

    vm.runInContext(`storageReady = true; state.appData.bufferPallets[0].waves = [{id:'TEST',priority:'Normal',origin:{picking:true,pulmao:false},time:'04/10/2026, 10:00'}];`, context);
    remote = { pallets: JSON.parse(vm.runInContext('JSON.stringify(state.appData.bufferPallets)', context)), revision: 2 };
    rpcError = { message: 'BUFFER_CONFLICT' };
    await vm.runInContext('handleWithdrawSubmit({preventDefault(){}})', context);
    assert.equal(vm.runInContext('state.appData.bufferPallets[0].waves.length', context), 1);
    assert.equal(vm.runInContext('bufferRevision', context), 2);
    assert.match(alerts.at(-1), /Outra pessoa/);
    assert.equal(element('modals').inert, false);

    rpcError = { message: 'Network failure' };
    const savedRemote = remote;
    remote = null;
    await vm.runInContext('handleWithdrawSubmit({preventDefault(){}})', context);
    assert.equal(vm.runInContext('state.appData.bufferPallets[0].waves.length', context), 1);
    assert.equal(vm.runInContext('storageBusy', context), false);
    assert.match(alerts.at(-1), /Não foi possível confirmar/);
    remote = savedRemote;

    element('login-user').value = 'Felipe';
    element('login-password').value = 'test-only';
    await vm.runInContext('loginBuffer({preventDefault(){}})', context);
    assert.equal(login.email, 'felipe@buffer.invalid');
    assert.equal(vm.runInContext('storageReady', context), true);
    element('login-user').value = 'Operador@example.com';
    await vm.runInContext('loginBuffer({preventDefault(){}})', context);
    assert.equal(login.email, 'operador@example.com');
    assert.match(vm.runInContext("loginErrorMessage({code:'email_not_confirmed'})", context), /Auto Confirm User/);
    assert.match(vm.runInContext("loginErrorMessage({code:'invalid_credentials'})", context), /identificador/);
    client.from = () => ({ select: () => ({ eq: () => ({ single: async () => ({ error: { code: 'PGRST116' } }) }) }) });
    await assert.rejects(vm.runInContext('loadCloudBuffer()', context), /Login confirmado.*supabase-access.sql/);
    client.from = () => ({ select: () => ({ eq: () => ({ single: async () => ({ error: { code: 'PGRST205' } }) }) }) });
    await assert.rejects(vm.runInContext('loadCloudBuffer()', context), /banco.*não foi configurado/);
    vm.runInContext("state.ui.selectedAddress = 'A1'; Object.values(state.ui.modals).forEach(m => m.open = false)", context);
    const mapHtml = vm.runInContext('renderBufferMap()', context);
    assert.match(mapHtml, /<dialog id="pallet-dialog"/);
    assert.match(mapHtml, /Vaga A1/);
    assert.match(mapHtml, /TEST/);
    const dialog = element('pallet-dialog');
    dialog.open = false;
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
    vm.runInContext('syncPalletDialog()', context);
    assert.equal(dialog.open, true);
    let centered;
    context.document.querySelectorAll = () => [];
    for (const address of ['A1', 'A2']) {
        const cell = element(`cell-${address}`);
        cell.classList = { add() {}, remove() {} };
        cell.querySelectorAll = () => [];
        cell.scrollIntoView = options => { centered = { address, options }; };
    }
    vm.runInContext("state.ui.selectedAddress = null; state.appData.bufferPallets[1].waves = [{...state.appData.bufferPallets[0].waves[0], id: 'TEST'}]; state.appData.bufferPallets[0].waves[0].id = 'TEST-2'; handleSearch(' test ')", context);
    assert.equal(centered.address, 'A2', 'Exact wave match takes priority over partial matches');
    assert.equal(centered.options.block, 'center');
    assert.equal(centered.options.inline, 'center');
    assert.equal(vm.runInContext('state.ui.selectedAddress', context), null, 'Search must not select a pallet or open its dialog');
    centered = null;
    vm.runInContext("handleSearch('test', true)", context);
    assert.equal(centered, null, 'Rerendering must not reposition the map');
    vm.runInContext("handleSearch('missing')", context);
    assert.equal(centered, null);
    const lookupInput = element('pallet-lookup-input');
    lookupInput.focus = () => {};
    lookupInput.select = () => {};
    lookupInput.value = '  l6\r\n';
    vm.runInContext("state.ui.searchBufferText = ''; state.ui.modals.palletLookup.open = true; handlePalletLookup({preventDefault(){}})", context);
    assert.equal(vm.runInContext('state.ui.selectedAddress', context), 'L6');
    assert.equal(vm.runInContext('state.ui.modals.palletLookup.open', context), false);
    lookupInput.value = 'Z9';
    vm.runInContext('state.ui.modals.palletLookup.open = true; handlePalletLookup({preventDefault(){}})', context);
    assert.equal(vm.runInContext('state.ui.selectedAddress', context), 'L6');
    assert.equal(vm.runInContext('state.ui.modals.palletLookup.open', context), true);
    assert.match(element('pallet-lookup-error').textContent, /Vaga não encontrada/);
    vm.runInContext('state.ui.modals.palletLookup.open = false', context);
    vm.runInContext('state.ui.modals.editWave.open = true; syncPalletDialog()', context);
    assert.equal(dialog.open, false, 'Details dialog must not block operation modals');
    vm.runInContext('state.ui.modals.editWave.open = false; syncPalletDialog()', context);
    assert.equal(dialog.open, true);
    console.log('OK: login, authenticated withdrawal, atomic RPC payload, conflict recovery and unlocked interface.');
})().catch(error => { console.error(error); process.exitCode = 1; });
