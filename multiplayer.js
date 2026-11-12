const project = "https://qoocmvqfndgrhlbluhxb.supabase.co";
const publicKey = "sb_publishable_AQicduKXmG-ZQsHd0VCCbQ_6PcORjkF";
let session;
let dialog;
let sheet;

async function request(path, method = "GET", body, authenticated = true) {
  const headers = { apikey: publicKey, "Content-Type": "application/json" };
  if (authenticated) {
    if (!session) throw new Error("Sign in first.");
    headers.Authorization = "Bearer " + session.access_token;
  }
  if (path.startsWith("/rest/")) headers.Prefer = "return=representation";
  const response = await fetch(project + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    if (authenticated && response.status === 401) session = null;
    throw new Error(result?.message || result?.msg || result?.error_description || "Request failed.");
  }
  return result;
}

const field = name => dialog.querySelector('[name="' + name + '"]');
function showAccount() {
  dialog.querySelector("[data-login]").hidden = !!session;
  dialog.querySelector("[data-account]").hidden = !session;
  dialog.querySelector("[data-email]").textContent = session?.user.email || "";
}
async function refresh() {
  const owner = session.user.id;
  const [characters, campaigns] = await Promise.all([
    request("/rest/v1/characters?select=id,name&owner_id=eq." + owner + "&order=name"),
    request("/rest/v1/campaigns?select=id,name,gm_id,join_code&order=name")
  ]);
  field("cloud").replaceChildren(...characters.map(c => new Option(c.name, c.id)));
  const list = dialog.querySelector("[data-campaigns]");
  list.replaceChildren(...campaigns.map(c => {
    const item = document.createElement("li");
    item.textContent = c.gm_id === owner ? c.name + " · GM · Join code " + c.join_code : c.name;
    return item;
  }));
}

async function act(action) {
  if (action === "login" || action === "signup") {
    if (!field("email").reportValidity() || !field("password").reportValidity()) return "";
    const route = action === "login" ? "token?grant_type=password" : "signup";
    const result = await request("/auth/v1/" + route, "POST", {
      email: field("email").value.trim(), password: field("password").value
    }, false);
    field("password").value = "";
    if (!result.access_token) return "Check your email to confirm your account, then sign in.";
    session = result;
    showAccount();
    await refresh();
    return "Signed in.";
  }
  if (action === "logout") {
    try { await request("/auth/v1/logout?scope=local", "POST"); }
    finally { session = null; field("cloud").replaceChildren(); dialog.querySelector("[data-campaigns]").replaceChildren(); }
    return "Signed out.";
  }
  if (action === "refresh") { await refresh(); return "Refreshed."; }
  const owner = session.user.id;
  if (action === "upload") {
    const character = sheet.current();
    if (!character) throw new Error("Open a campaign character in the sheet first.");
    const { _cloudLink: link, ...data } = character;
    const linked = link?.owner === owner && link.localId === character.id;
    const body = { name: character.name || "Unnamed character", character_data: data,
      updated_at: new Date().toISOString() };
    const filter = linked ? "?id=eq." + encodeURIComponent(link.id) + "&owner_id=eq." + owner +
      "&updated_at=eq." + encodeURIComponent(link.version) + "&select=id,updated_at" : "?select=id,updated_at";
    if (!linked) body.owner_id = owner;
    const rows = await request("/rest/v1/characters" + filter, linked ? "PATCH" : "POST", body);
    if (!rows.length) throw new Error("The cloud copy changed. Restore it as a new local character before editing that version.");
    character._cloudLink = { owner, localId: character.id, id: rows[0].id, version: rows[0].updated_at };
    sheet.save();
    await refresh();
    field("cloud").value = rows[0].id;
    return "Saved " + body.name + " online.";
  }
  if (action === "restore" || action === "join") {
    const id = field("cloud").value;
    if (!id) throw new Error("Select a cloud character first.");
    if (action === "restore") {
      const [row] = await request("/rest/v1/characters?id=eq." + id + "&owner_id=eq." + owner + "&select=character_data,updated_at");
      if (!row || !row.character_data || typeof row.character_data !== "object" || Array.isArray(row.character_data))
        throw new Error("This character could not be restored.");
      sheet.addCopy({ ...row.character_data, _cloudLink: { owner, id, version: row.updated_at } });
      return "Added a copy to your local campaign character list.";
    }
    const code = field("code").value.trim();
    if (!code) throw new Error("Enter the GM’s join code.");
    await request("/rest/v1/rpc/join_campaign", "POST", { p_join_code: code, p_character_id: id });
    await refresh();
    return "Joined campaign with the selected character.";
  }
  if (action === "create") {
    const name = field("campaign").value.trim();
    if (!name) throw new Error("Enter a campaign name.");
    const join_code = crypto.randomUUID().replaceAll("-", "").slice(0,12).toUpperCase();
    await request("/rest/v1/campaigns", "POST", { name, gm_id: owner, join_code });
    await refresh();
    return "Campaign created. Share the join code with your players.";
  }
}

export function openMultiplayer(adapter) {
  sheet = adapter;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "ArchSoul multiplayer");
    dialog.style.cssText = "max-width:min(32rem,92vw);max-height:85vh;overflow:auto;padding:1.2rem;color:CanvasText;background:Canvas;border-radius:.5rem";
    dialog.innerHTML = `
      <button type="button" style="float:right" data-close>Close</button><h2>Multiplayer</h2>
      <fieldset><div data-login>
        <label>Email <input name="email" type="email" required autocomplete="username"></label>
        <label>Password <input name="password" type="password" required autocomplete="current-password"></label>
        <p><button data-action="login">Sign in</button> <button data-action="signup">Create account</button></p>
      </div><div data-account hidden>
        <span data-email></span> <button data-action="logout">Sign out</button>
        <h3>Characters</h3><button data-action="upload">Save current character online</button>
        <p><label>Cloud character <select name="cloud"></select></label></p>
        <button data-action="restore">Add local copy</button> <button data-action="refresh">Refresh</button>
        <h3>Campaigns</h3><ul data-campaigns></ul>
        <p><label>Campaign name <input name="campaign"></label> <button data-action="create">Create as GM</button></p>
        <label>Join code <input name="code"></label> <button data-action="join">Join with selected character</button>
      </div></fieldset><p role="status" aria-live="polite"></p>`;
    document.body.append(dialog);
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.addEventListener("close", () => { field("password").value = ""; });
    dialog.addEventListener("click", async event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      const controls = dialog.querySelector("fieldset");
      if (!action || controls.disabled) return;
      controls.disabled = true;
      const status = dialog.querySelector("[role=status]");
      status.textContent = "Working…";
      try { status.textContent = await act(action); }
      catch (error) { status.textContent = error.message; }
      finally { controls.disabled = false; showAccount(); }
    });
  }
  showAccount();
  dialog.showModal();
}
