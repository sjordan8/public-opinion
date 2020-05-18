FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./
ENV MONGODB_URL mongodb://public-opinion_mongodb_1
RUN npm install
# If you are building you code for production
# RUN npm ci --only=production

COPY . .

EXPOSE 5000
CMD [ "node", "app.js" ]
