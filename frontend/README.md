#Instalar o Projeto Angular
npm install

#Rodar o Projeto
npm run dev

#Criar BUILD para Homologação
url: api: 'http://10.11.0.8:4000/api'
comando: npm run build:hml

#Criar BUILD para Produção
url: api: 'http://10.11.0.8:3000/api'
comando: npm run build:prod
