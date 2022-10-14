ARG LATEST_AGENTS=dev
ARG LATEST_AGENT_WATCHER=dev
FROM data.stack.b2b.agent.watcher:${LATEST_AGENT_WATCHER} AS watcher
FROM data.stack.b2b.agents:${LATEST_AGENTS} AS agent
FROM node:18.9.1-alpine3.16

RUN apk update
RUN apk upgrade

RUN set -ex; apk add --no-cache --virtual .fetch-deps curl tar ;

WORKDIR /app

COPY package.json package.json

RUN npm install -g npm
RUN npm install --production
RUN npm audit fix --production
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/test

COPY . .

COPY --from=watcher /app/exec ./generatedAgent/sentinels
COPY --from=agent /app/scriptFiles/LICENSE ./generatedAgent/
COPY --from=agent /app/scriptFiles/README.md ./generatedAgent/
COPY --from=agent /app/scriptFiles ./generatedAgent/scriptFiles
COPY --from=agent /app/exec ./generatedAgent/exes

ENV IMAGE_TAG=__image_tag__
ENV NODE_ENV='production'
EXPOSE 10011
EXPOSE 10443

# RUN chmod -R 777 /app

CMD [ "node", "app.js" ]