# 1. Comece com a imagem base do Node.js
FROM node:18-slim

# 2. Instale as dependências do sistema que o Chrome precisa
# Esta é a parte que corrige o erro 'libgobject-2.0.so.0'
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libasound2 \
    libxss1 \
    libxtst6 \
    libgobject-2.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. Configure o diretório de trabalho
WORKDIR /app

# 4. Copie os arquivos de pacote e instale as dependências do npm
COPY package*.json ./
RUN npm install

# 5. Copie o resto do seu projeto
COPY . .

# 6. Defina o comando para iniciar o servidor
CMD [ "npm", "start" ]