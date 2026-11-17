const assert = require("node:assert/strict");
const test = require("node:test");
const login = require("../api/login");
const session = require("../api/session");
const state = require("../api/state");

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = JSON.parse(body);
    }
  };
}

function configureCredentials(t) {
  const names = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "SESSION_SECRET", "NODE_ENV", "VERCEL"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => names.forEach(name => {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }));
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD = "a-strong-test-password";
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL;
}

const sameOriginHeaders = { origin: "http://localhost:3000", host: "localhost:3000" };

test("admin login creates an HttpOnly cookie accepted by the session endpoint", async t => {
  configureCredentials(t);
  const loginResponse = mockResponse();
  await login({
    method: "POST",
    headers: sameOriginHeaders,
    body: { email: "ADMIN@example.com", password: "a-strong-test-password" }
  }, loginResponse);

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.body.authenticated, true);
  const cookie = loginResponse.headers["set-cookie"];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const sessionResponse = mockResponse();
  await session({
    method: "GET",
    headers: { cookie: cookie.split(";")[0] }
  }, sessionResponse);
  assert.deepEqual(sessionResponse.body, { authenticated: true });

  const tamperedResponse = mockResponse();
  const [name, value] = cookie.split(";")[0].split("=");
  const [payload, signature] = value.split(".");
  await session({
    method: "GET",
    headers: { cookie: `${name}=${payload}.${signature.slice(0, -1)}x` }
  }, tamperedResponse);
  assert.deepEqual(tamperedResponse.body, { authenticated: false });
});

test("admin login rejects invalid credentials and cross-origin requests", async t => {
  configureCredentials(t);
  const invalidCredentialsResponse = mockResponse();
  await login({
    method: "POST",
    headers: sameOriginHeaders,
    body: { email: "admin@example.com", password: "wrong-password" }
  }, invalidCredentialsResponse);
  assert.equal(invalidCredentialsResponse.statusCode, 401);

  const crossOriginResponse = mockResponse();
  await login({
    method: "POST",
    headers: { origin: "https://attacker.example", host: "localhost:3000" },
    body: { email: "admin@example.com", password: "a-strong-test-password" }
  }, crossOriginResponse);
  assert.equal(crossOriginResponse.statusCode, 403);
});

test("state updates are rejected without an authenticated admin session", async t => {
  configureCredentials(t);
  const response = mockResponse();
  await state({
    method: "PUT",
    headers: sameOriginHeaders,
    body: {
      members: [],
      settings: { secondSaturdayTime: "18:00", fourthSaturdayTime: "17:00" },
      masses: [],
      initialOrderApplied: false
    }
  }, response);
  assert.equal(response.statusCode, 401);
});
