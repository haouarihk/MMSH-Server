FROM node:10-alpine

COPY . /main
WORKDIR /main

RUN yarn

RUN yarn install --dev-dependencies

RUN npm run build

CMD ["npm", "run", "ts-server"] 