# Acólitos São Francisco

Sistema simples para organizar a escala dos acólitos da Comunidade São Francisco.

## Como usar

Abra `index.html` em um navegador. Os dados ficam salvos localmente no navegador utilizado.

Para acessar **Administrador**:

- Usuário: `admin@acolitos.com`
- Senha: `adminacolitos`

O acesso é uma barreira simples para uso informal. Como as credenciais ficam no JavaScript da página, qualquer pessoa com acesso ao arquivo pode visualizá-las ou contornar a tela de login. Não use esta versão para proteger informações privadas.

Na área **Administrador**, cadastre os acólitos e gere a escala dos próximos seis meses. A programação padrão é:

- 2º sábado do mês, às 18:00;
- 4º sábado do mês, às 17:00.

Na seção de datas e horários, cada missa pode ser ajustada individualmente: data, horário, acólitos e funções. A geração tenta variar as equipes, distribuir as presenças e alternar as funções de forma equilibrada. Uma nova geração substitui as escalas existentes para o período.

Também é possível registrar uma observação de até 500 caracteres em cada missa. Quando houver uma, um indicador dourado aparece na programação e o texto fica visível nos detalhes e no destaque da próxima missa. As observações são públicas na página inicial e ficam salvas junto com os dados locais.

Ao adicionar um acólito, também é possível selecionar uma foto de perfil. Ela é reduzida para facilitar o armazenamento e aparece na lista de acólitos, na equipe da próxima missa e nos detalhes das escalas. A foto e os demais dados continuam salvos somente no navegador utilizado; não são sincronizados entre dispositivos.

As funções são fixas por missa: no 2º sábado servem três acólitos (Microfone, Naveta e Turíbulo); no 4º sábado servem dois (Microfone e Missal). São necessários pelo menos três acólitos cadastrados para gerar a escala completa.

Na primeira geração, se Amanda, Fabrício e Brenda forem os três acólitos cadastrados, o sistema usa a rotação de funções e duplas do PDF de referência, repetindo o ciclo de seis meses. As gerações seguintes voltam a priorizar a variação e o equilíbrio automático.