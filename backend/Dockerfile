FROM node:10

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY package.json /opt/app/
COPY yarn.lock /opt/app/
ENV MONGODB_URL mongodb://public-opinion_mongodb_1
RUN npm install
RUN npm install -g nodemon
# If you are building you code for production
# RUN npm ci --only=production

COPY . /opt/app/

EXPOSE 5000
CMD [ "nodemon", "app.js" ]
