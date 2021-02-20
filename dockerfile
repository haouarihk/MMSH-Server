FROM ubuntu:20.04

ENV TZ=Europe/Kiev
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install --assume-yes default-jre npm

CMD ["npm", "run", "server"] 