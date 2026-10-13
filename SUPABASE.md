# Ativar o buffer

O aplicativo usa o projeto `zysujgsgqemvjoijrkcs` e login por usuário e senha.
O buffer é compartilhado entre todas as contas cadastradas e autenticadas. Não há cadastro público no site.

1. Abra o SQL Editor desse projeto e execute todo o arquivo `supabase-setup.sql`.
   Depois execute `supabase-history.sql` para ativar o histórico usado por esta versão.
2. Em Authentication → Users → Add user → Create new user, crie cada conta.
   Para o usuário `felipe`, use o identificador interno `felipe@buffer.invalid` e escolha uma senha.
   Marque **Auto Confirm User**. Esse identificador não precisa de caixa de e-mail e não recebe confirmação.
   Use nomes com letras sem acentos, números, ponto, hífen ou sublinhado; sempre minúsculos.
3. Abra o site e entre com `felipe` e a senha cadastrada. Todas as contas cadastradas
   podem adicionar, editar, realocar e retirar ondas.

Se você já executou a versão anterior de `supabase-setup.sql`, execute apenas
`supabase-access.sql` para liberar o acesso a todas as contas. Os dados existentes são preservados.

Se a conta foi criada com outro identificador (por exemplo, um e-mail já existente),
informe esse identificador completo no campo Usuário. A senha é a da conta em
Authentication → Users, e não a senha do painel Supabase ou a senha do banco.
Não é necessário cadastrar permissões individuais em `buffer_members`.

Ondas ativas ficam salvas no banco. Ao retirar um palete para a bancada, todas as suas
ondas saem do buffer e são arquivadas em `buffer_withdrawals` na mesma transação.
O prazo de 48 horas começa na retirada, medido pelo servidor. Os registros ficam
inacessíveis após esse prazo e são apagados pelo job a cada minuto (pode haver até
um minuto de atraso na exclusão física). A limpeza funciona mesmo com o site fechado.
O botão Retirar onda retira apenas a onda escolhida, mantendo as demais no palete.
Essa retirada também fica registrada por 48 horas. Para atualizar um banco configurado
anteriormente, execute `supabase-withdraw-wave.sql` uma vez no SQL Editor.
Para atualizar o prazo de um banco existente, execute `supabase-retention-48h.sql`.
Ele atualiza o prazo das retiradas ainda armazenadas e das próximas retiradas.
Registros que já foram apagados não são recuperados. Ondas ativas continuam no buffer
até serem retiradas; o prazo de 48 horas começa somente na retirada.

Os dados antigos em `localStorage` são preservados, mas não são importados automaticamente.
O banco passa a ser a fonte dos dados; não é permitido gravar operações offline.
Outros dispositivos atualizam o mapa a cada 15 segundos quando não há modal aberto.
Alterações simultâneas são detectadas pela revisão e exigem conferir os dados antes de repetir a operação.

## Histórico de movimentações

Para um banco já configurado, execute `supabase-history.sql` uma vez no SQL Editor
antes de usar esta versão do site. A nova função salva a movimentação e o registro
na mesma transação; se houver falha, nenhuma das duas alterações é confirmada.
O script preserva a ocupação atual e a função anterior.

A aba Histórico permite filtrar Entrada, Realocação, Edição, Retirada e Agrupamento,
buscar pelo número exato da onda (incluindo o número anterior em uma renomeação)
e navegar por páginas de 30 registros. Cada registro contém as ondas alteradas,
vagas, valores anteriores e posteriores, conta responsável e data do servidor.
Datas são exibidas no fuso America/Sao_Paulo.

Entradas, realocações, edições e agrupamentos em `buffer_history` são permanentes.
Somente as retiradas, incluindo a remoção de todas as ondas de um palete, expiram
48 horas após a retirada, tanto em `buffer_withdrawals` quanto no histórico.
A política de acesso oculta os registros expirados e o job os apaga a cada minuto.
Execute a versão atual de `supabase-retention-48h.sql` para atualizar um banco existente.
O histórico começa após a instalação, para movimentações feitas por esta versão
do aplicativo. Operações anteriores não são reconstruídas.
Contas autenticadas podem consultar o histórico; o navegador não pode inserir,
editar ou apagar registros diretamente. A função calcula as diferenças no servidor.

Para verificar depois de instalar, faça uma entrada, edição, realocação e retirada
de uma onda de teste pelo site, confira os filtros e execute:

```sql
select id, action, wave_ids, actor_name, created_at,
       before_entries, after_entries
from public.buffer_history order by created_at desc, id desc limit 10;
```

## Verificação da ocupação e retiradas temporárias

```sql
select id, revision, jsonb_array_length(pallets) as vagas from public.buffer_state;
select address, wave->>'id' as onda, withdrawn_at, expires_at from public.buffer_withdrawals;
select jobname, schedule, active from cron.job where jobname = 'buffer-delete-expired-withdrawals';
select status, return_message, start_time from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'buffer-delete-expired-withdrawals')
order by start_time desc limit 5;
```

O primeiro resultado deve mostrar 60 vagas. Faça um teste adicionando e retirando uma onda:
ela deve sair de `buffer_state`, aparecer em `buffer_withdrawals` e ter diferença de
48 horas entre `withdrawn_at` e `expires_at`.

As tabelas possuem RLS e permitem acesso às contas autenticadas. A chave publicável
não concede acesso sem login. O registro de retirada identifica a conta que fez a operação.

## Layout com 60 vagas

Todas as colunas A–L têm linhas 1–5.
Para atualizar um banco existente, realoque ou retire as ondas de A6 até L6
na versão anterior do site e execute `supabase-layout.sql` no SQL Editor
antes de usar a nova versão. O script bloqueia a atualização se essas vagas
estiverem ocupadas e preserva as demais ondas e o histórico.
