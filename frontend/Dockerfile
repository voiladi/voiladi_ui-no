# Voiladi web - production image for Railway (static React build served by nginx)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
# Railway passes service variables as build args; CRA bakes REACT_APP_* in at build time.
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    CI=false \
    GENERATE_SOURCEMAP=false \
    NODE_OPTIONS=--max-old-space-size=4096
RUN yarn build

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY security-headers.inc.template /etc/nginx/templates/security-headers.inc.template
# derives WS_BACKEND_URL for the Content-Security-Policy; sourced (not executed) by the nginx entrypoint
COPY docker/15-derive-ws.envsh /docker-entrypoint.d/15-derive-ws.envsh
RUN chmod 755 /docker-entrypoint.d/15-derive-ws.envsh
ENV PORT=3000
EXPOSE 3000
