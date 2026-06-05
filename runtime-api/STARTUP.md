RS OS Runtime Startup

docker run -d \
  --name rsos-runtime-api \
  --network rsos_default \
  -p 127.0.0.1:8080:8080 \
  --env-file /opt/rsos/runtime-api/.env \
  rsos-runtime-api1~RS OS Runtime Startup

docker run -d \
  --name rsos-runtime-api \
  --network rsos_default \
  -p 127.0.0.1:8080:8080 \
  --env-file /opt/rsos/runtime-api/.env \
  rsos-runtime-api
