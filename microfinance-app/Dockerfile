FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN apt-get update -y && apt-get install -y openssl

# Pass DATABASE_URL env var from Render Build Environment Variables to Docker build
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
