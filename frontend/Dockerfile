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
ENV PORT=3000
EXPOSE 3000
