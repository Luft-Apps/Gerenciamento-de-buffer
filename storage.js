// Armazena apenas a ocupação atual. O site não mantém registros de movimentações.
const BufferStorage = (() => {
    const key = 'luft-buffer-v1';

    function validate(pallets) {
        if (!Array.isArray(pallets) || pallets.length !== 72) throw new Error('Dados do buffer inválidos.');
        const addresses = new Set();
        for (const pallet of pallets) {
            if (!/^[A-L][1-6]$/.test(pallet.address) || addresses.has(pallet.address)
                || !Array.isArray(pallet.waves) || pallet.waves.length > 4) throw new Error('Vaga inválida nos dados salvos.');
            addresses.add(pallet.address);
            const ids = new Set();
            for (const wave of pallet.waves) {
                if (!wave || !/^[A-Z0-9][A-Z0-9._/-]{0,63}$/.test(wave.id) || ids.has(wave.id)
                    || !['Normal', 'Urgente'].includes(wave.priority)
                    || typeof wave.origin?.picking !== 'boolean' || typeof wave.origin?.pulmao !== 'boolean'
                    || (!wave.origin.picking && !wave.origin.pulmao)
                    || typeof wave.time !== 'string' || !/^[0-9/,:\s]{1,40}$/.test(wave.time)) {
                    throw new Error('Onda inválida nos dados salvos.');
                }
                ids.add(wave.id);
            }
        }
        return pallets.map(p => ({
            address: p.address,
            waves: p.waves.map(w => ({
                id: w.id, priority: w.priority,
                origin: { picking: w.origin.picking, pulmao: w.origin.pulmao }, time: w.time
            }))
        }));
    }

    function load() {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        const saved = JSON.parse(raw);
        if (saved.version !== 1) throw new Error('Versão dos dados não reconhecida.');
        return validate(saved.bufferPallets);
    }

    function save(pallets) {
        localStorage.setItem(key, JSON.stringify({ version: 1, bufferPallets: validate(pallets) }));
    }

    return { load, save, validate };
})();
