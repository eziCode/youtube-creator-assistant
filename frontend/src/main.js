const app = document.getElementById("app");

const FRONTEND_PATH = window.location.pathname;

const renderLogin = () => {
  const container = document.createElement("div");

  const heading = document.createElement("h1");
  heading.textContent = "YouTube Creator Assistant";

  const button = document.createElement("button");
  button.id = "google-login-button";
  button.textContent = "Login with Google";

  button.addEventListener("click", () => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
    window.location.href = `${apiUrl.replace(/\/$/, "")}/auth/google`;
  });

  container.appendChild(heading);
  container.appendChild(button);

  return container;
};

const renderStatus = (title, details) => {
  const container = document.createElement("div");

  const heading = document.createElement("h2");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = details;

  const backLink = document.createElement("a");
  backLink.href = "/";
  backLink.textContent = "Back to login";

  container.appendChild(heading);
  container.appendChild(paragraph);
  container.appendChild(backLink);

  return container;
};

const renderSuccess = (searchParams) => {
  const container = document.createElement("div");

  const heading = document.createElement("h2");
  heading.textContent = "Authentication Successful";

  const description = document.createElement("p");
  description.textContent = "Tokens received from Google:";

  const list = document.createElement("dl");
  list.style.wordBreak = "break-word";

  const entries = [
    ["Name", searchParams.get("name") ?? ""],
    ["Email", searchParams.get("email") ?? ""],
    ["Access Token", searchParams.get("access_token") ?? ""],
    ["Refresh Token", searchParams.get("refresh_token") ?? ""],
    ["Token Type", searchParams.get("token_type") ?? ""],
    ["Scope", searchParams.get("scope") ?? ""],
    ["Expiry Date", searchParams.get("expiry_date") ?? ""],
    ["ID Token", searchParams.get("id_token") ?? ""],
  ];

  entries.forEach(([key, value]) => {
    if (!value) return;
    const term = document.createElement("dt");
    term.textContent = key;

    const definition = document.createElement("dd");
    definition.textContent = value;

    list.appendChild(term);
    list.appendChild(definition);
  });

  const backLink = document.createElement("a");
  backLink.href = "/";
  backLink.textContent = "Back to login";

  container.appendChild(heading);
  container.appendChild(description);
  container.appendChild(list);
  container.appendChild(backLink);

  return container;
};

const bootstrap = () => {
  app.replaceChildren();

  if (FRONTEND_PATH === "/auth/error") {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message") || "Authentication failed.";
    app.appendChild(renderStatus("Authentication Failed", message));
    return;
  }

  if (FRONTEND_PATH === "/auth/success") {
    const params = new URLSearchParams(window.location.search);
    app.appendChild(renderSuccess(params));
    return;
  }

  app.appendChild(renderLogin());
};

bootstrap();

