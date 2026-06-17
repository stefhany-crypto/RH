// ========== GLOBALS — MIRAE APP ==========
let user=null, equipes=[], talentos=[], avaliacoes=[], bonusConfigs=[], charts={};
let todosColabs=[];
let _balaoTimer=null;
let premioConfigs = [];  // {equipe, ano, numSalarios, criadoPorNome, dataCriacao}
let metasLucratividade = []; // {ano, percentual, criadoPorNome, dataCriacao}
let analyticsMenu = 'PDI';
let vrConfigs = [];
let lancamentosVTVR = [];
let previewData = [];
let _vtvrUltimoDoc=null, _vtvrTemMais=false;
const VTVR_LIMITE=80; // registros por página
let denunciasListener = null;
let denuncias = [];
let dailys=[],dailyTarefas=[],dailyColabs=[];
const STATUS_TAREFA = {
    pendente:     {label:'Pendente',      cor:'#9CA3AF'},
    andamento:    {label:'Em Andamento',  cor:'#EF6C00'},
    concluida:    {label:'Concluída',     cor:'#2E7D32'},
    nao_realizada:{label:'Não Realizada', cor:'#C62828'}
};
let tarefasPessoais=[], ttCarregado=false;
let ttListaAtiva='hoje', ttSortBy='manual', ttMostrarConcluidas=false, ttDetalheKey=null;
let ttSelMode=false, ttSelecionadas=new Set();
const TT_SMART=[
    {key:'hoje',label:'Hoje',ico:'sun2'},
    {key:'atrasadas',label:'Atrasadas',ico:'alert'},
    {key:'proximas',label:'Próximas',ico:'calendar'},
    {key:'todas',label:'Todas',ico:'inbox'},
    {key:'eisenhower',label:'Eisenhower',ico:'target'},
    {key:'concluidas',label:'Concluídas',ico:'check'}
];
const TT_PRIO={alta:{label:'Alta'},media:{label:'Média'},baixa:{label:'Baixa'}};
let dailyView='dailys';
const MESES_NOME=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let mesaSalaAtiva = 1;
let mesaSelecionada = null;
window._reservasDia = {};
let kanbanBoards=[], kbCards=[], kbBoardAtivo=null, kbCardAberto=null;
let kbListenerBoards=null, kbListenerCards=null, kbDragCardId=null, kbIniciado=false;
let kbTalentos=[];
let _kbNPrioSel=null;

// ========== BACKUP KEY ==========
const BACKUP_KEY = 'mirae_ultimo_backup';

// ========== PDI GROUPS ==========
const PDI_GROUPS=[
    {n:"1. Postura e Comportamento Profissional",c:["Postura diante de problemas e imprevistos do dia a dia.","Responsabilidade sobre erros e inteligência emocional para lidar com críticas.","Forma de se comunicar com a equipe (clareza, tom de voz e assertividade).","Educação, cordialidade e respeito no trato com colegas e liderados.","Postura sob pressão ou picos de demanda operacional.","Pontualidade e cumprimento da carga horária combinada.","Zelo com as informações internas e confidencialidade da empresa."]},
    {n:"2. Atendimento e Experiência do Cliente/Médico",c:["Presteza e agilidade no suporte inicial e respostas rápidas.","Resolução definitiva do problema apresentado, evitando reaberturas.","Empatia e acolhimento em situações de conflito ou reclamações.","Qualidade e clareza nas explicações e direcionamentos repassados.","Fidelização e percepção de valor gerada no atendimento executado."]},
    {n:"3. Autonomia e Dependência",c:["Capacidade de resolver demandas rotineiras sem necessidade de supervisão próxima.","Busca activa por soluções antes de acionar o gestor direto.","Interpretação e aplicação correta dos processos mapeados.","Segurança técnica e precisão na execução de suas rotinas de trabalho.","Necessidade de reorientação ou acompanhamento para a mesma tarefa recorrente.","Tomada de decisões operacionais coerentes com as diretrizes do setor.","Tentativa prévia de solução e compilação de alternatives antes de escalar problemas."]},
    {n:"4. Resolutividade",c:["Resolve a demanda de ponta a ponta ou repassa com clareza a responsabilidade.","Capacidade investigativa para identificar a causa raiz de um problema.","Velocidade e senso de urgência compatíveis com o impacto da questão.","Antecipação de potenciais gargalos ou impactos colaterais antes que virem problemas.","Organização estruturada das tratativas e histórico das pendências.","Conclusão e encerramento efetivo de projetos ou ordens de serviço.","Follow-up consistente com as partes interessadas até o fechamento da demanda."]},
    {n:"5. Estudo e Desenvolvimento",c:["Busca constante por novos conhecimentos de forma proativa e independente.","Estudo aprofundado dos processos internos da Mirae e fluxos operacionais.","Interesse genuíno em aprender novas habilidades ou ferramentas de mercado.","Evolução técnica visível e maturidade profissional ao longo do período.","Retenção de aprendizados anteriores e não repetição de falhas por falta de atenção.","Aplicação prática imediata de novos conceitos absorvidos em cursos ou mentorias.","Participação engajada e contribuição produtiva em treinamentos oferecidos."]},
    {n:"6. Organização e Execução",c:["Organização e estruturação clara da sua fila ou carteira de demandas diárias.","Manutenção e atualização rigorosa de sistemas, painéis e registros de controle.","Cumprimento rigoroso de prazos acordados com clientes internos ou externos.","Atenção aos detalhes e capricho visual/estrutural nas entregas geradas.","Controle rígido de pendências antigas para que nada fique esquecido no fluxo.","Baixo índice de retrabalho ou correções necessárias após a primeira entrega.","Confiabilidade das entregas (o gestor confia na informação sem precisar auditar)."]},
    {n:"7. Eficiência e Uso de Ferramentas",c:["Uso eficiente e aproveitamento máximo das ferramentas homologadas da empresa.","Velocidade de aprendizado e adaptação a novos softwares adotados.","Busca constante por automações ou atalhos que reduzam o tempo operacional.","Organização digital impecável de pastas, arquivos compartilhados e acessos.","Domínio técnico avançado de planilhas ou ferramentas essenciais do setor.","Capacidade de propor soluções tecnológicas viáveis para gargalos existentes.","Uso consciente de recursos, licenças e acessos da companhia, evitando desperdícios.","Identificação e relato ágil de falhas ou bugs encontrados nos sistemas de uso."]}
];

// ========== VERSÍCULOS E VALORES ==========
const VERSICULOS=[
    {t:'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.',r:'João 3:16'},
    {t:'Tudo quanto fizerdes, fazei-o de todo o coração, como para o Senhor.',r:'Colossenses 3:23'},
    {t:'O homem diligente verá os seus desejos satisfeitos.',r:'Provérbios 13:4'},
    {t:'Sede fortes e corajosos; não temais.',r:'Deuteronômio 31:6'},
    {t:'Cada um exerça o dom que recebeu para servir aos outros.',r:'1 Pedro 4:10'},
    {t:'Onde não há visão, o povo perece.',r:'Provérbios 29:18'},
    {t:'O ferro com o ferro se afia; assim o homem afia o seu próximo.',r:'Provérbios 27:17'},
    {t:'Confia ao Senhor as tuas obras, e teus planos serão estabelecidos.',r:'Provérbios 16:3'}
];
const VALORES_MIRAE=[
    {l:'P',n:'Perfeição',d:'honramos vidas com precisão.'},
    {l:'A',n:'Audácia',d:'avançamos onde outros hesitam.'},
    {l:'V',n:'Verdade',d:'vivemos sem máscaras, sem atalhos.'},
    {l:'A',n:'Amor',d:'cuidamos como se fosse a Ele.'},
    {l:'P',n:'Prosperidade',d:'multiplicamos valor e legado.'}
];

// ===== VERSÍCULOS DE ANIVERSÁRIO (esperança · alegria · comemoração) =====
const VERSICULOS_ANIVERSARIO=[
{t:'Este é o dia que o Senhor fez; regozijemo-nos e alegremo-nos nele.',r:'Salmos 118:24'},
{t:'O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.',r:'Números 6:24-25'},
{t:'Porque eu bem sei os planos que tenho a vosso respeito: planos de paz e não de mal, para vos dar um futuro e uma esperança.',r:'Jeremias 29:11'},
{t:'A alegria do Senhor é a vossa força.',r:'Neemias 8:10'},
{t:'Deleita-te no Senhor, e ele satisfará os desejos do teu coração.',r:'Salmos 37:4'},
{t:'O Senhor é a minha força e o meu escudo; nele confiou o meu coração e fui socorrido; por isso o meu coração salta de prazer.',r:'Salmos 28:7'},
{t:'Ensina-nos a contar os nossos dias, para que alcancemos coração sábio.',r:'Salmos 90:12'},
{t:'Os que esperam no Senhor renovam as suas forças; sobem com asas como águias.',r:'Isaías 40:31'},
{t:'Tu coroas o ano da tua bondade; e as tuas veredas destilam fartura.',r:'Salmos 65:11'},
{t:'O Senhor cumprirá o seu propósito em mim; a tua benignidade, ó Senhor, dura para sempre.',r:'Salmos 138:8'},
{t:'Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.',r:'Filipenses 4:4'},
{t:'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.',r:'1 Pedro 5:7'},
{t:'Bendize, ó minha alma, ao Senhor, e não te esqueças de nenhum dos seus benefícios.',r:'Salmos 103:2'},
{t:'O Senhor é o meu pastor; nada me faltará.',r:'Salmos 23:1'},
{t:'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.',r:'Salmos 37:5'},
{t:'Grandes coisas fez o Senhor por nós, e por isso estamos alegres.',r:'Salmos 126:3'},
{t:'A esperança que se adia faz adoecer o coração, mas o desejo cumprido é árvore de vida.',r:'Provérbios 13:12'},
{t:'O Senhor te dará segundo o teu coração e cumprirá todo o teu desígnio.',r:'Salmos 20:4'},
{t:'Porque para sempre é a sua misericórdia.',r:'Salmos 136:1'},
{t:'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.',r:'Provérbios 3:5'},
{t:'O Senhor é bom, uma fortaleza no dia da angústia, e conhece os que nele confiam.',r:'Naum 1:7'},
{t:'Sê forte e corajoso; não temas, porque o Senhor, teu Deus, é contigo por onde quer que andares.',r:'Josué 1:9'},
{t:'Em ti, Senhor, espero; tu me responderás, Senhor, Deus meu.',r:'Salmos 38:15'},
{t:'O justo florescerá como a palmeira; crescerá como o cedro no Líbano.',r:'Salmos 92:12'},
{t:'O coração alegre é como bom remédio.',r:'Provérbios 17:22'},
{t:'Tu me farás ver a vereda da vida; na tua presença há fartura de alegrias.',r:'Salmos 16:11'},
{t:'O Senhor é a minha luz e a minha salvação; a quem temerei?',r:'Salmos 27:1'},
{t:'Aquele que começou a boa obra em vós há de completá-la até ao Dia de Cristo Jesus.',r:'Filipenses 1:6'},
{t:'Buscai primeiro o Reino de Deus, e todas as coisas vos serão acrescentadas.',r:'Mateus 6:33'},
{t:'O Senhor pelejará por vós, e vós vos calareis.',r:'Êxodo 14:14'},
{t:'A bênção do Senhor é que enriquece, e não acrescenta dores.',r:'Provérbios 10:22'},
{t:'Bem-aventurado o homem cuja força está em ti.',r:'Salmos 84:5'},
{t:'Ainda que a figueira não floresça, eu me alegrarei no Senhor.',r:'Habacuque 3:17-18'},
{t:'O Senhor é a minha porção; portanto, esperarei nele.',r:'Lamentações 3:24'},
{t:'As misericórdias do Senhor são a causa de não sermos consumidos; renovam-se cada manhã.',r:'Lamentações 3:22-23'},
{t:'Deus é o nosso refúgio e fortaleza, socorro bem presente nas tribulações.',r:'Salmos 46:1'},
{t:'Tudo posso naquele que me fortalece.',r:'Filipenses 4:13'},
{t:'O choro pode durar uma noite, mas a alegria vem pela manhã.',r:'Salmos 30:5'},
{t:'O Senhor guardará a tua entrada e a tua saída, desde agora e para sempre.',r:'Salmos 121:8'},
{t:'Não andeis ansiosos por coisa alguma; em tudo, com ação de graças, sejam conhecidas as vossas petições.',r:'Filipenses 4:6'},
{t:'Provai e vede que o Senhor é bom; bem-aventurado o homem que nele confia.',r:'Salmos 34:8'},
{t:'O Senhor é a tua sombra à tua direita.',r:'Salmos 121:5'},
{t:'Os que semeiam em lágrimas com júbilo ceifarão.',r:'Salmos 126:5'},
{t:'O nome do Senhor é torre forte; o justo corre para ela e está seguro.',r:'Provérbios 18:10'},
{t:'O Senhor é a força da minha vida; de quem me recearei?',r:'Salmos 27:1'},
{t:'Espera no Senhor, anima-te, e ele fortalecerá o teu coração.',r:'Salmos 27:14'},
{t:'Regozijai-vos na esperança, sede pacientes na tribulação.',r:'Romanos 12:12'},
{t:'O Senhor está perto de todos os que o invocam.',r:'Salmos 145:18'},
{t:'A tua palavra é lâmpada para os meus pés e luz para o meu caminho.',r:'Salmos 119:105'},
{t:'Aquietai-vos e sabei que eu sou Deus.',r:'Salmos 46:10'},
{t:'O Senhor te guiará continuamente e fartará a tua alma.',r:'Isaías 58:11'},
{t:'Como o pai se compadece dos filhos, assim o Senhor se compadece dos que o temem.',r:'Salmos 103:13'},
{t:'Sobre tudo o que se deve guardar, guarda o teu coração, porque dele procedem as fontes da vida.',r:'Provérbios 4:23'},
{t:'O Senhor é compassivo e misericordioso, longânimo e cheio de bondade.',r:'Salmos 103:8'},
{t:'Bem-aventurados os que confiam no Senhor.',r:'Jeremias 17:7'},
{t:'O Senhor te abençoará e fará prosperar tudo quanto empreenderes.',r:'Deuteronômio 28:8'},
{t:'Pela manhã, ouve a minha voz; pela manhã, apresento-te a minha oração e espero.',r:'Salmos 5:3'},
{t:'A luz do justo brilha cada vez mais até ser dia perfeito.',r:'Provérbios 4:18'},
{t:'O Senhor é a minha rocha, a minha fortaleza e o meu libertador.',r:'Salmos 18:2'},
{t:'Deus enxugará de seus olhos toda lágrima.',r:'Apocalipse 21:4'},
{t:'Tudo tem o seu tempo determinado debaixo do céu.',r:'Eclesiastes 3:1'},
{t:'O Senhor te renova como a águia a tua mocidade.',r:'Salmos 103:5'},
{t:'Que o Deus da esperança vos encha de todo o gozo e paz no vosso crer.',r:'Romanos 15:13'},
{t:'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.',r:'Isaías 41:10'},
{t:'O Senhor é a minha herança; nele espera a minha alma.',r:'Salmos 16:5'},
{t:'Quão precioso é, ó Deus, o teu amor!',r:'Salmos 36:7'},
{t:'O Senhor dará força ao seu povo; o Senhor abençoará o seu povo com paz.',r:'Salmos 29:11'},
{t:'Alegrar-me-ei e exultarei na tua benignidade.',r:'Salmos 31:7'},
{t:'O Senhor é bom para todos, e as suas misericórdias estão sobre todas as suas obras.',r:'Salmos 145:9'},
{t:'Deus fará novas todas as coisas.',r:'Apocalipse 21:5'},
{t:'A minha alma engrandece ao Senhor, e o meu espírito se alegra em Deus.',r:'Lucas 1:46-47'},
{t:'Bendigo o Senhor em todo o tempo; o seu louvor estará continuamente na minha boca.',r:'Salmos 34:1'},
{t:'O Senhor faz justiça e julga com retidão a todos os oprimidos.',r:'Salmos 103:6'},
{t:'Mais vale o fim das coisas do que o seu princípio.',r:'Eclesiastes 7:8'},
{t:'O Senhor te sustenta; tu és a sua menina dos olhos.',r:'Deuteronômio 32:10'},
{t:'A paz vos deixo, a minha paz vos dou.',r:'João 14:27'},
{t:'O justo viverá pela fé.',r:'Romanos 1:17'},
{t:'O Senhor abençoa a habitação dos justos.',r:'Provérbios 3:33'},
{t:'Cantai ao Senhor um cântico novo, porque ele fez maravilhas.',r:'Salmos 98:1'},
{t:'O Senhor é o meu auxílio; não temerei o que me possa fazer o homem.',r:'Hebreus 13:6'},
{t:'Renova-se de força em força; cada um deles aparece diante de Deus em Sião.',r:'Salmos 84:7'},
{t:'O Senhor cumpre os desejos dos que o temem; ouve o seu clamor e os salva.',r:'Salmos 145:19'},
{t:'O teu sol nunca mais se porá; o Senhor será a tua luz perpétua.',r:'Isaías 60:20'},
{t:'Lança o teu pão sobre as águas, porque depois de muitos dias o acharás.',r:'Eclesiastes 11:1'},
{t:'O Senhor é a minha canção; ele se tornou a minha salvação.',r:'Êxodo 15:2'},
{t:'Os justos clamam, e o Senhor os ouve, e os livra de todas as suas angústias.',r:'Salmos 34:17'},
{t:'O coração do homem planeja o seu caminho, mas o Senhor lhe dirige os passos.',r:'Provérbios 16:9'},
{t:'Tu és precioso aos meus olhos, e digno de honra, e eu te amo.',r:'Isaías 43:4'},
{t:'A esperança não traz confusão, porque o amor de Deus está derramado em nossos corações.',r:'Romanos 5:5'},
{t:'O Senhor é a força do meu coração e a minha porção para sempre.',r:'Salmos 73:26'},
{t:'Deus é fiel; ele vos confirmará e guardará do maligno.',r:'2 Tessalonicenses 3:3'},
{t:'Quem encontra uma esposa acha o bem e alcança a benevolência do Senhor.',r:'Provérbios 18:22'},
{t:'O Senhor me ouviu e me livrou de todos os meus temores.',r:'Salmos 34:4'},
{t:'A vossa vida está escondida com Cristo em Deus.',r:'Colossenses 3:3'},
{t:'Ainda que eu ande pelo vale da sombra da morte, não temerei mal algum, porque tu estás comigo.',r:'Salmos 23:4'},
{t:'O Senhor é grande e mui digno de ser louvado.',r:'Salmos 145:3'},
{t:'Aquele que habita no esconderijo do Altíssimo descansará à sombra do Onipotente.',r:'Salmos 91:1'},
{t:'Servi ao Senhor com alegria; apresentai-vos diante dele com canto.',r:'Salmos 100:2'},
{t:'O Senhor guarda a todos os que o amam.',r:'Salmos 145:20'},
{t:'O justo será em memória eterna.',r:'Salmos 112:6'},
{t:'A graça do Senhor Jesus seja com o vosso espírito.',r:'Filipenses 4:23'},
{t:'O Senhor abrirá o seu bom tesouro e abençoará toda obra das tuas mãos.',r:'Deuteronômio 28:12'},
{t:'O Senhor reina; regozije-se a terra; alegrem-se as muitas ilhas.',r:'Salmos 97:1'},
{t:'Bendita seja a tua entrada, e bendita, a tua saída.',r:'Deuteronômio 28:6'},
{t:'O amor é paciente, é benigno; o amor jamais acaba.',r:'1 Coríntios 13:4-8'}
];

// ========== SALAS ==========
const SALAS = {
    1: {
        nome: 'Sala 1 — Escalas',
        vw: 280, vh: 300,
        mesas: [
            { id:'M1', label:'Mesa 1', x:82,  y:18, w:58, h:65 },
            { id:'M2', label:'Mesa 2', x:148, y:18, w:58, h:65 },
            { id:'M3', label:'Mesa 3', x:82,  y:113, w:58, h:65 },
            { id:'M4', label:'Mesa 4', x:148, y:113, w:58, h:65 },
            { id:'M5', label:'Mesa 5', x:82,  y:208, w:58, h:65 },
            { id:'M6', label:'Mesa 6', x:148, y:208, w:58, h:65 },
        ],
        chairs: [
            {x:56,y:26,w:18,h:12,r:3},{x:56,y:57,w:18,h:12,r:3},
            {x:44,y:121,w:18,h:12,r:3},{x:44,y:151,w:18,h:12,r:3},
            {x:214,y:121,w:18,h:12,r:3},{x:214,y:151,w:18,h:12,r:3},
            {x:44,y:216,w:18,h:12,r:3},{x:44,y:246,w:18,h:12,r:3},
            {x:214,y:216,w:18,h:12,r:3},{x:214,y:246,w:18,h:12,r:3},
        ]
    },
    2: {
        nome: 'Sala de Reunião',
        vw: 280, vh: 300,
        semJanela: true,
        // Mesa de reunião central (decorativa)
        mesaCentral: { x:96, y:60, w:88, h:180 },
        // 6 posições: 3 de cada lado da mesa de reunião
        mesas: [
            { id:'S2M1', label:'Lugar 1', x:18,  y:62,  w:66, h:50 },
            { id:'S2M2', label:'Lugar 2', x:18,  y:124, w:66, h:50 },
            { id:'S2M3', label:'Lugar 3', x:18,  y:186, w:66, h:50 },
            { id:'S2M4', label:'Lugar 4', x:196, y:62,  w:66, h:50 },
            { id:'S2M5', label:'Lugar 5', x:196, y:124, w:66, h:50 },
            { id:'S2M6', label:'Lugar 6', x:196, y:186, w:66, h:50 },
        ],
        chairs: []
    }
};

// ========== KB COLUNAS DEFAULT ==========
const KB_COLUNAS_DEFAULT=[
    {id:'backlog',   nome:'A Fazer',      cor:'#9CA3AF', ordem:0},
    {id:'progresso', nome:'Em Progresso', cor:'#EF6C00', ordem:1},
    {id:'revisao',   nome:'Em Revisão',   cor:'#1E7D90', ordem:2},
    {id:'concluido', nome:'Concluído',    cor:'#2E7D32', ordem:3}
];
