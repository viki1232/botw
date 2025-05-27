FROM node:18-bullseye as bot

# Instala las dependencias necesarias para compilar sharp
RUN apt-get update && apt-get install -y \
    libvips-dev \
    build-essential \
    python3

WORKDIR /app

# Elimina node_modules y package-lock.json si existen
RUN rm -rf node_modules package-lock.json

COPY package*.json ./

# Instala las dependencias con resolución de dependencias forzada
RUN npm install --legacy-peer-deps

# Recompila sharp para asegurarse de que se adapte al entorno de Render
RUN npm rebuild sharp --platform=linux --arch=x64

# Copia el resto de los archivos
COPY . .

ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT

CMD ["npm", "start"]
