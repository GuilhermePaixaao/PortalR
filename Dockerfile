# 1. Comece com a imagem base do Node.js
FROM node:18-slim

# 2. Configure o diretório de trabalho
WORKDIR /app

# 3. Copie os arquivos de pacote e instale as dependências do npm
COPY package*.json ./
RUN npm install

# 4. Copie o resto do seu projeto
COPY . .

# 5. Defina o comando para iniciar o servidor
CMD [ "npm", "start" ]