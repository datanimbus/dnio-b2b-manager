ARG LATEST_B2BGW=dev
ARG RELEASE=dev
# FROM data.stack:govault.${RELEASE} AS vault
# FROM data.stack:b2b-agent-watcher.${RELEASE} AS watcher
# FROM data.stack:b2bgw.${LATEST_B2BGW} AS agent
FROM node:16-alpine

RUN set -ex; apk add --no-cache --virtual .fetch-deps curl tar git ;

WORKDIR /app

COPY package.json package.json

RUN npm install --production

COPY . .

# COPY --from=vault /app/exec ./generatedAgent/vault
# COPY --from=vault /app/LICENSE ./generatedAgent/
# COPY --from=watcher /app/exec ./generatedAgent/sentinels
# COPY --from=watcher /app/scriptFiles ./generatedAgent/scriptFiles
# COPY --from=agent /app/exec ./generatedAgent/exes

ENV IMAGE_TAG=__image_tag__
EXPOSE 10011
EXPOSE 10443

#RUN adduser -D appuser
#RUN chown -R appuser /app
RUN chmod -R 777 /app
#USER appuser

CMD [ "node", "app.js" ]