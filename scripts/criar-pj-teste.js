/**
 * Cria um usuário PJ de teste via Firebase REST API.
 * Usa o refresh_token do firebase-tools já autenticado na máquina.
 * Uso: node scripts/criar-pj-teste.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');

const PROJECT = 'pdimirae';
const EMAIL   = 'pj.teste@audazhealth.com';
const SENHA   = 'Teste@123';
const NOME    = 'PJ Teste';

// Credenciais públicas do firebase-tools CLI (estão no código aberto)
const GOOG_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const GOOG_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const ftConfig  = JSON.parse(fs.readFileSync(os.homedir()+'/.config/configstore/firebase-tools.json','utf8'));
const REFRESH_TOKEN = ftConfig.tokens?.refresh_token;

function req(options, body){
    return new Promise((resolve,reject)=>{
        const r=https.request(options, res=>{
            let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
                try{resolve({status:res.statusCode,body:JSON.parse(d)});}
                catch(e){resolve({status:res.statusCode,body:d});}
            });
        });
        r.on('error',reject);
        if(body)r.write(typeof body==='string'?body:JSON.stringify(body));
        r.end();
    });
}

async function getAccessToken(){
    const body=`client_id=${encodeURIComponent(GOOG_CLIENT_ID)}&client_secret=${encodeURIComponent(GOOG_CLIENT_SECRET)}&refresh_token=${encodeURIComponent(REFRESH_TOKEN)}&grant_type=refresh_token`;
    const r=await req({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},body);
    if(!r.body.access_token)throw new Error('Falha ao obter access_token: '+JSON.stringify(r.body));
    return r.body.access_token;
}

async function createAuthUser(token){
    // Tenta criar via Identity Toolkit REST
    const body=JSON.stringify({email:EMAIL,password:SENHA,displayName:NOME,returnSecureToken:false});
    const r=await req({hostname:'identitytoolkit.googleapis.com',path:`/v1/projects/${PROJECT}/accounts?access_token=${token}`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},body);
    if(r.status===200||r.status===201)return r.body.localId;
    // Se já existe, busca
    if(r.body?.error?.message?.includes('EMAIL_EXISTS')){
        const lookup=JSON.stringify({identifier:EMAIL,tenantId:''});
        const r2=await req({hostname:'identitytoolkit.googleapis.com',path:`/v1/projects/${PROJECT}/accounts:lookup?access_token=${token}`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(lookup)}},lookup);
        const uid=r2.body?.users?.[0]?.localId;
        if(uid){console.log('  Usuário já existe no Auth, uid:', uid);return uid;}
    }
    throw new Error('Erro ao criar usuário Auth: '+JSON.stringify(r.body));
}

async function firestoreSet(token, docPath, data){
    // Converte objeto JS para formato Firestore REST
    function toValue(v){
        if(v===null)return{nullValue:null};
        if(typeof v==='boolean')return{booleanValue:v};
        if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
        if(typeof v==='string')return{stringValue:v};
        if(v instanceof Date)return{timestampValue:v.toISOString()};
        if(Array.isArray(v))return{arrayValue:{values:v.map(toValue)}};
        if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,val])=>[k,toValue(val)]))}};
        return{stringValue:String(v)};
    }
    const fields=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,toValue(v)]));
    const body=JSON.stringify({fields});
    const path=`/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
    const r=await req({hostname:'firestore.googleapis.com',path,method:'PATCH',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Authorization':'Bearer '+token}},body);
    if(r.status!==200)throw new Error('Firestore erro '+r.status+': '+JSON.stringify(r.body));
}

async function main(){
    console.log('Obtendo access token...');
    const token=await getAccessToken();
    console.log('Token obtido.');

    console.log('Criando usuário no Auth...');
    const uid=await createAuthUser(token);
    console.log('UID:', uid);

    console.log('Gravando documento principal...');
    await firestoreSet(token, `colaboradores/${uid}`, {
        nome:           NOME,
        email:          EMAIL,
        equipe:         'Tecnologia',
        cargo:          'Desenvolvedor PJ',
        tipoContrato:   'PJ',
        tipoAvaliacao:  'normal',
        role:           'COLABORADOR',
        ativo:          true,
        avatarUrl:      '',
        dataNascimento: '',
    });

    console.log('Gravando dados financeiros...');
    await firestoreSet(token, `colaboradores/${uid}/financeiro/dados`, {
        salario:      5000,
        valorVT:      0,
        cnpj:         '12.345.678/0001-99',
        razaoSocial:  'PJ Teste Ltda',
        dataAdmissao: '2026-06-01',
    });

    console.log('\n✓ Usuário PJ de teste criado!');
    console.log('  Email:', EMAIL);
    console.log('  Senha:', SENHA);
    console.log('  UID:  ', uid);
    console.log('  Salario: R$ 5000 | Admissao: 2026-06-01 (proporcional Jun/2026)');
}

main().catch(e=>{console.error('\nERRO:', e.message); process.exit(1);});
