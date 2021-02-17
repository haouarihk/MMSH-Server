FROM ubuntu:20.04

ENV TZ=Europe/Kiev
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install default-jre npm
RUN npm install
RUN npm run b-tsc
CMD ["npm", "run", "server"] 