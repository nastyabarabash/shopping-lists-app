FROM denoland/deno:alpine-1.42.2

EXPOSE 7777

WORKDIR /app

COPY ./app/deps.js .

RUN deno cache ./app/deps.js

COPY ./app ./

CMD [ "run", "--allow-env", "--allow-net", "--allow-read", "--watch", "--unstable", "app.js" ]