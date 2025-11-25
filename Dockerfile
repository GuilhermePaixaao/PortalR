FROM node:18-slim

# Instala dependências básicas do sistema (caso precise para bibliotecas nativas)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (Cache Layer)
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código (aqui o .dockerignore vai impedir de copiar o node_modules local)
COPY . .

# Expõe a porta (apenas documentação, o Railway injeta a porta real)
EXPOSE 3000

CMD [ "npm", "start" ]