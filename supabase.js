// Chave publicável: pode ser utilizada no navegador. O acesso aos dados depende de RLS.
const BufferSupabase = (() => {
    const url = 'https://zysujgsgqemvjoijrkcs.supabase.co';
    const publishableKey = 'sb_publishable_vmYcgT5UTx4d6b1Z_LW3uA_6voWDqD_';

    async function request(path, { accessToken, headers, ...options } = {}) {
        const response = await fetch(`${url}${path}`, {
            ...options,
            headers: {
                apikey: publishableKey,
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                ...headers
            }
        });
        const body = await response.text();
        let data;
        try { data = body ? JSON.parse(body) : null; }
        catch (_) { throw new Error('Resposta inválida do Supabase.'); }
        if (!response.ok) {
            throw new Error(data?.message || data?.msg || `Erro Supabase (${response.status}).`);
        }
        return data;
    }

    function checkConnection() {
        return request('/auth/v1/settings');
    }

    const client = window.supabase?.createClient(url, publishableKey);
    function getClient() {
        if (!client) throw new Error('Não foi possível carregar a conexão. Verifique sua internet e recarregue a página.');
        return client;
    }
    return Object.freeze({ url, request, checkConnection, getClient });
})();
