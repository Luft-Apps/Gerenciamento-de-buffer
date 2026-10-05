# Ativar o buffer

O aplicativo usa o projeto `zysujgsgqemvjoijrkcs` e login por usuário e senha.
O buffer é compartilhado entre todas as contas cadastradas e autenticadas. Não há cadastro público no site.

1. Abra o SQL Editor desse projeto e execute todo o arquivo `supabase-setup.sql`.
2. Em Authentication → Users → Add user → Create new user, crie cada conta.
   Para o usuário `felipe`, use o identificador interno `felipe@buffer.invalid` e escolha uma senha.
   Marque **Auto Confirm User**. Esse identificador não precisa de caixa de e-mail e não recebe confirmação.
   Use nomes com letras sem acentos, números, ponto, hífen ou sublinhado; sempre minúsculos.
3. Abra o site e entre com `felipe` e a senha cadastrada. Todas as contas cadastradas
   podem adicionar, editar, realocar, retirar e excluir ondas.

Se você já executou a versão anterior de `supabase-setup.sql`, execute apenas
`supabase-access.sql` para liberar o acesso a todas as contas. Os dados existentes são preservados.

Se a conta foi criada com outro identificador (por exemplo, um e-mail já existente),
informe esse identificador completo no campo Usuário. A senha é a da conta em
Authentication → Users, e não a senha do painel Supabase ou a senha do banco.
Não é necessário cadastrar permissões individuais em `buffer_members`.

Ondas ativas ficam salvas no banco. Ao retirar um palete para a bancada, todas as suas
ondas saem do buffer e são arquivadas em `buffer_withdrawals` na mesma transação.
O prazo de 2 horas começa na retirada, medido pelo servidor. Os registros ficam
inacessíveis após esse prazo e são apagados pelo job a cada minuto (pode haver até
um minuto de atraso na exclusão física). A limpeza funciona mesmo com o site fechado.
Excluir manualmente uma onda não cria um registro de retirada para a bancada.

Os dados antigos em `localStorage` são preservados, mas não são importados automaticamente.
O banco passa a ser a fonte dos dados; não é permitido gravar operações offline.
Outros dispositivos atualizam o mapa a cada 15 segundos quando não há modal aberto.
Alterações simultâneas são detectadas pela revisão e exigem conferir os dados antes de repetir a operação.

## Verificar no banco

```sql
select id, revision, jsonb_array_length(pallets) as vagas from public.buffer_state;
select address, wave->>'id' as onda, withdrawn_at, expires_at from public.buffer_withdrawals;
select jobname, schedule, active from cron.job where jobname = 'buffer-delete-expired-withdrawals';
select status, return_message, start_time from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'buffer-delete-expired-withdrawals')
order by start_time desc limit 5;
```

O primeiro resultado deve mostrar 72 vagas. Faça um teste adicionando e retirando uma onda:
ela deve sair de `buffer_state`, aparecer em `buffer_withdrawals` e ter diferença de
2 horas entre `withdrawn_at` e `expires_at`.

As tabelas possuem RLS e permitem acesso às contas autenticadas. A chave publicável
não concede acesso sem login. O registro de retirada identifica a conta que fez a operação.
