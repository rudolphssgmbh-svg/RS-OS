const BASE_URL = "http://127.0.0.1:8080";

async function login() {

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: "janette",
      password: "rsos2026"
    })
  });

  const data = await res.json();

  if (!data.token) {
    throw new Error("Login failed");
  }

  return data.token;
}

async function runWorker() {

  const token = await login();

  const res = await fetch(`${BASE_URL}/runtime/worker/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  console.log(
    new Date().toISOString(),
    JSON.stringify(data)
  );
}

setInterval(() => {

  runWorker().catch(err => {

    console.error(
      new Date().toISOString(),
      "worker-loop-error",
      err.message
    );
  });

}, 5000);

console.log("RS OS worker loop started");
