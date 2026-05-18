<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mirae - Sistema de Avaliações</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body class="bg-gray-50">
    <div id="app"></div>
    <script>
        const DB={init(){if(!localStorage.getItem('mirae_users')){localStorage.setItem('mirae_users',JSON.stringify([{id:1,nome:"Stefhany (Admin)",email:"stefhany@mirae.com",senha:"admin123",tipo:"admin",cargo:"CEO",departamento:"Diretoria",salario:15000,tipoAvaliacao:"adm"},{id:2,nome:"Mariana Silva",email:"mariana@mirae.com",senha:"123456",tipo:"colaborador",cargo:"Analista Operacional Financeiro",departamento:"Administrativo",salario:4000,tipoAvaliacao:"adm"},{id:3,nome:"Jullia Santos",email:"jullia@mirae.com",senha:"123456",tipo:"colaborador",cargo:"Analista Cadastros",departamento:"Administrativo",salario:3500,tipoAvaliacao:"adm"},{id:4,nome:"Carlos Mendes",email:"carlos@mirae.com",senha:"123456",tipo:"gestor",cargo:"Gestor de Escalas",departamento:"Escalas",salario:4200,tipoAvaliacao:"escalas"}]))}if(!localStorage.getItem('mirae_avaliacoes')){localStorage.setItem('mirae_avaliacoes',JSON.stringify({}))}},getUsers(){return JSON.parse(localStorage.getItem('mirae_users')||'[]')},getUser(email,senha){return this.getUsers().find(u=>u.email===email&&u.senha===senha)},getUserById(id){return this.getUsers().find(u=>u.id===id)},getAvaliacoes(){return JSON.parse(localStorage.getItem('mirae_avaliacoes')||'{}')},saveAvaliacao(userId,trimestre,ano,data){const avaliacoes=this.getAvaliacoes();avaliacoes[`${userId}_${ano}_${trimestre}`]={userId,trimestre,ano,data,updatedAt:new Date().toISOString()};localStorage.setItem('mirae_avaliacoes',JSON.stringify(avaliacoes))},addUser(userData){const users=this.getUsers();const newUser={id:Math.max(...users.map(u=>u.id),0)+1,...userData,createdAt:new Date().toISOString()};users.push(newUser);localStorage.setItem('mirae_users',JSON.stringify(users));return newUser},updateUser(id,userData){const users=this.getUsers();const index=users.findIndex(u=>u.id===id);if(index!==-1){users[index]={...users[index],...userData,updatedAt:new Date().toISOString()};localStorage.setItem('mirae_users',JSON.stringify(users));return users[index]}return null},deleteUser(id){localStorage.setItem('mirae_users',JSON.stringify(this.getUsers().filter(u=>u.id!==id)));return true}};DB.init();const Auth={currentUser:null,login(email,senha){const user=DB.getUser(email,senha);if(user){this.currentUser=user;sessionStorage.setItem('mirae_current_user',JSON.stringify(user));return true}return false},logout(){this.currentUser=null;sessionStorage.removeItem('mirae_current_user');render()},checkAuth(){const stored=sessionStorage.getItem('mirae_current_user');if(stored){this.currentUser=JSON.parse(stored);return true}return false},isAdmin(){return this.currentUser?.tipo==='admin'},isGestor(){return this.currentUser?.tipo==='gestor'}};
    </script>
</body>
</html>
