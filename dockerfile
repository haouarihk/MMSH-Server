FROM node:12-alpine
WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install default-jre
RUN yarn
CMD ["npm", "run", "server"] 