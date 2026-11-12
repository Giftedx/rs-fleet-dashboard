(function installViewerBridge(host) {
  let privacyReady = !1, renderReady = !1, feedConnected = null, failed = !1, announced = !1, heldRoster = null, heldRosterAt = 0, hiddenNames = new Set, publishedFollow = null, publishedWorldMap = !1, publishedCamera = "", freeCameraPolls = 0;
  const HIDDEN_ALIAS = "Hidden", hiddenHashes = new Set, learned = new Set;
  let filterLoaded = !1;
  const held = [], fnv = (value) => {
    let h = 2166136261;
    for (let i = 0;i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }, undo = [], emit = (detail = !privacyReady ? "Loading the 3D world\u2026 applying the name filter." : !renderReady ? "Loading the 3D world\u2026 drawing the first frame." : "3D world ready.") => {
    if (host.parent === host)
      return;
    const state = failed ? "error" : privacyReady && renderReady ? "ready" : "loading";
    if (state === "ready" && heldRoster) {
      const send = heldRoster;
      heldRoster = null;
      if (Date.now() - heldRosterAt < 30000)
        send();
    }
    host.parent.postMessage({ viewerState: { state, privacyReady, renderReady, feedConnected, detail } }, host.location.origin);
    if (state === "ready" && !announced) {
      announced = !0;
      for (const restore of undo.splice(0))
        restore();
    }
  }, fail = (detail) => {
    failed = !0;
    privacyReady = !1;
    emit(detail);
  }, url = new host.URL(host.location.href), hidden = url.searchParams.get("hideNamesFrom");
  let hiddenUrl;
  try {
    hiddenUrl = new host.URL(hidden, host.location.href);
  } catch {
    fail("Private name filter URL is unavailable.");
    return;
  }
  if (!hidden || hiddenUrl.origin !== host.location.origin || !hiddenUrl.pathname.endsWith("/api/hidden-names") || hiddenUrl.search) {
    fail("Private name filter must use this dashboard.");
    return;
  }
  const glType = host.WebGL2RenderingContext;
  if (!glType) {
    fail("WebGL2 is unavailable; use the 2D map.");
    return;
  }
  emit("Loading the private name filter and a rendered geometry frame.");
  const fetch = host.fetch.bind(host);
  host.fetch = async (input, init) => {
    let target;
    try {
      target = new host.URL(typeof input === "string" ? input : input?.url ?? String(input), host.location.href);
    } catch {
      return fetch(input, init);
    }
    let response;
    try {
      response = await fetch(input, init);
    } catch (e) {
      if (target.href === hiddenUrl.href)
        fail("Private name filter could not be loaded.");
      throw e;
    }
    if (target.href !== hiddenUrl.href)
      return response;
    if (!response.ok) {
      fail("Private name filter could not be loaded.");
      return response;
    }
    const json = response.json.bind(response);
    response.json = async () => {
      try {
        const list = await json();
        if (!Array.isArray(list) || list.length < 1 || list.length > 64 || list.some((n) => typeof n !== "string" || !/^(?:[A-Za-z0-9_ -]{1,12}|h:[0-9a-f]{8})$/.test(n)))
          throw Error("invalid name filter");
        const names = list.filter((n) => !n.startsWith("h:"));
        for (const n of list)
          if (n.startsWith("h:"))
            hiddenHashes.add(n.slice(2));
        hiddenNames = new Set([...names.map((n) => n.toLowerCase()), ...learned]);
        filterLoaded = !0;
        for (const deliver of held.splice(0))
          deliver();
        host.requestAnimationFrame(() => host.requestAnimationFrame(() => {
          if (!failed) {
            privacyReady = !0;
            emit();
          }
        }));
        return hiddenHashes.size ? [...names, HIDDEN_ALIAS] : list;
      } catch (e) {
        fail("Private name filter was not applied; the viewer stays hidden.");
        throw e;
      }
    };
    return response;
  };
  const context = new WeakMap, extensions = new WeakSet, mainCanvas = (gl) => gl.canvas?.tagName === "CANVAS" && gl.canvas.isConnected === !0 && gl.canvas.tabIndex === 0 && gl.canvas.width >= 32 && gl.canvas.height >= 32, record = (gl, count, instances) => {
    if (failed || announced || !mainCanvas(gl) || !(count > 0 && instances > 0))
      return;
    let state = context.get(gl);
    if (!state) {
      state = { geometry: !1 };
      context.set(gl, state);
    }
    if (gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null) {
      if (count > 6)
        state.geometry = !0;
    } else if (state.geometry) {
      state.geometry = !1;
      host.requestAnimationFrame(() => {
        if (!failed) {
          renderReady = !0;
          emit();
        }
      });
    }
  }, patch = (object, key, wrap) => {
    const original = object[key];
    if (typeof original !== "function")
      return;
    object[key] = wrap(original);
    undo.push(() => {
      object[key] = original;
    });
  }, proto = glType.prototype;
  for (const [key, countIndex, instanceIndex] of [["drawElements", 1, -1], ["drawArrays", 2, -1], ["drawElementsInstanced", 1, 4], ["drawArraysInstanced", 2, 3]])
    patch(proto, key, (original) => function(...args) {
      const result = original.apply(this, args);
      record(this, Number(args[countIndex]), instanceIndex < 0 ? 1 : Number(args[instanceIndex]));
      return result;
    });
  patch(proto, "clear", (original) => function(...args) {
    const result = original.apply(this, args);
    if (this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) {
      const state = context.get(this);
      if (state)
        state.geometry = !1;
    }
    return result;
  });
  patch(proto, "getExtension", (original) => function(name) {
    const ext = original.call(this, name), gl = this;
    if (ext && /multi_draw/i.test(name) && !extensions.has(ext)) {
      extensions.add(ext);
      for (const key of ["multiDrawElementsInstancedWEBGL", "multiDrawArraysInstancedWEBGL"])
        patch(ext, key, (draw) => function(...args) {
          const result = draw.apply(this, args), arrays = key.includes("Arrays"), counts = args[arrays ? 3 : 1], instances = args[arrays ? 5 : 6], countOffset = args[arrays ? 4 : 2], instanceOffset = args[arrays ? 6 : 7], draws = args[arrays ? 7 : 8];
          if (countOffset === 0 && instanceOffset === 0 && counts && instances)
            for (let i = 0;i < Math.min(Number(draws), counts.length); i++)
              record(gl, Number(counts[i]), Number(instances[i]));
          return result;
        });
    }
    return ext;
  });
  let botGround = [], groundVersion = 0;
  const groundRow = (r) => Array.isArray(r) && r.length === 5 && r.every(Number.isSafeInteger) && r[0] >= 0 && r[0] < 16384 && r[1] >= 0 && r[1] < 16384 && r[2] >= 0 && r[2] < 4 && r[3] >= 0 && r[3] < 65536 && r[4] >= 1 && r[4] < 2147483648, Socket = host.WebSocket;
  if (Socket)
    host.WebSocket = class extends Socket {
      constructor(address, protocols) {
        super(address, protocols);
        try {
          if (new host.URL(String(address), host.location.href).pathname === "/worldfeed") {
            this.addEventListener("open", () => {
              feedConnected = !0;
              emit();
            });
            this.addEventListener("close", () => {
              feedConnected = !1;
              emit();
            });
            this.addEventListener("error", () => {
              feedConnected = !1;
              emit();
            });
            let accessor = null;
            for (let p = Socket.prototype;p && !accessor; p = Object.getPrototypeOf(p))
              accessor = Object.getOwnPropertyDescriptor(p, "onmessage");
            const rosterRows = new Map, fullRoster = (event) => {
              if (typeof event?.data !== "string" || event.data.length > 2000000 || !event.data.includes('"roster"'))
                return event;
              try {
                const m = JSON.parse(event.data);
                if (m.t !== "roster")
                  return event;
                if (Array.isArray(m.p)) {
                  rosterRows.clear();
                  for (const r of m.p)
                    if (Array.isArray(r))
                      rosterRows.set(r[0], r);
                  return event;
                }
                for (const slot of Array.isArray(m.lv) ? m.lv : [])
                  rosterRows.delete(slot);
                for (const r of Array.isArray(m.j) ? m.j : [])
                  if (Array.isArray(r))
                    rosterRows.set(r[0], r);
                for (const r of Array.isArray(m.m) ? m.m : []) {
                  const row = Array.isArray(r) ? rosterRows.get(r[0]) : void 0;
                  if (row) {
                    row[2] = r[1];
                    row[3] = r[2];
                    row[4] = r[3];
                    if (r.length > 4)
                      row[5] = r[4];
                  }
                }
                return new host.MessageEvent("message", { data: JSON.stringify({ t: "roster", k: m.k, p: [...rosterRows.values()], npcs: m.npcs }), origin: event.origin });
              } catch {}
              return event;
            }, rename = (event) => {
              if (!hiddenHashes.size || typeof event?.data !== "string")
                return event;
              let data = event.data;
              if (data.includes('"roster"'))
                try {
                  const m = JSON.parse(data);
                  if (m.t === "roster") {
                    for (const p of [...Array.isArray(m.p) ? m.p : [], ...Array.isArray(m.j) ? m.j : []])
                      if (Array.isArray(p) && typeof p[1] === "string" && /^[A-Za-z0-9_ -]{1,12}$/.test(p[1]) && hiddenHashes.has(fnv(p[1].toLowerCase()))) {
                        learned.add(p[1].toLowerCase());
                        hiddenNames.add(p[1].toLowerCase());
                      }
                  }
                } catch {}
              for (const name of learned)
                data = data.replace(new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"), HIDDEN_ALIAS);
              return data === event.data ? event : new host.MessageEvent("message", { data, origin: event.origin });
            };
            let area = null, seenVersion = -1;
            const piles = new Map, inArea = (a, x, z) => !!a && x >= a.x && x < a.x + a.w && z >= a.z && z < a.z + a.h, addGround = (event) => {
              if (typeof event?.data !== "string" || event.data.length > 2000000 || !event.data.includes('"tick"'))
                return event;
              if (seenVersion === groundVersion && !/"(?:za|oa|od|oc|reset)"/.test(event.data))
                return event;
              let m;
              try {
                m = JSON.parse(event.data);
              } catch {
                return event;
              }
              if (m?.t !== "tick")
                return event;
              const w = Array.isArray(m.w) ? m.w : [];
              if (m.reset)
                piles.clear();
              for (const r of w)
                if (r?.e === "za" && [r.x, r.z, r.w, r.h].every(Number.isFinite)) {
                  const next = { x: r.x, z: r.z, w: r.w, h: r.h };
                  if (r.r)
                    piles.clear();
                  else
                    for (const g of [...piles.keys()]) {
                      const [x, z] = g.split(",").map(Number);
                      if (!inArea(area, x, z) || !inArea(next, x, z))
                        piles.delete(g);
                    }
                  area = next;
                } else if ((r?.e === "oa" || r?.e === "od" || r?.e === "oc") && [r.x, r.z, r.l, r.id].every(Number.isSafeInteger)) {
                  const g = `${r.x},${r.z},${r.l},${r.id}`, list = piles.get(g) ?? [];
                  if (r.e === "oa") {
                    if (r.id >= 0 && r.n >= 1)
                      list.push({ f: !0, n: r.n });
                  } else if (r.e === "od")
                    list.shift();
                  else if (r.n >= 1) {
                    const i = list.findIndex((p) => p.n === r.n0), p = list[i >= 0 ? i : 0];
                    if (p && !p.f) {
                      const j = list.findIndex((q) => q.f && q.n === r.n0);
                      if (j >= 0) {
                        list[j].f = !1;
                        p.f = !0;
                      }
                    }
                    if (p)
                      p.n = r.n;
                  }
                  list.length ? piles.set(g, list) : piles.delete(g);
                }
              seenVersion = groundVersion;
              const want = new Map;
              if (area)
                for (const row of botGround) {
                  if (!inArea(area, row[0], row[1]))
                    continue;
                  const g = row.slice(0, 4).join(","), list = want.get(g) ?? [];
                  list.push(row[4]);
                  want.set(g, list);
                }
              const add = [];
              for (const g of new Set([...piles.keys(), ...want.keys()])) {
                const list = piles.get(g) ?? [], feed = list.filter((p) => p.f).map((p) => p.n), ours = [...want.get(g) ?? []], now = list.filter((p) => !p.f).map((p) => p.n);
                for (const n of feed) {
                  const i = ours.indexOf(n);
                  if (i >= 0)
                    ours.splice(i, 1);
                }
                if (now.length === ours.length && now.every((n, i) => n === ours[i]))
                  continue;
                const [x, z, l, id] = g.split(",").map(Number);
                for (let i = 0;i < list.length; i++)
                  add.push({ e: "od", x, z, l, id });
                const next = [...feed.map((n) => ({ f: !0, n })), ...ours.map((n) => ({ f: !1, n }))];
                for (const p of next)
                  add.push({ e: "oa", x, z, l, id, n: p.n });
                next.length ? piles.set(g, next) : piles.delete(g);
              }
              if (!add.length)
                return event;
              m.w = [...w, ...add];
              return new host.MessageEvent("message", { data: JSON.stringify(m), origin: event.origin });
            }, forViewer = (event) => addGround(rename(event));
            if (accessor?.set) {
              let handler = null;
              Object.defineProperty(this, "onmessage", { configurable: !0, get: () => handler, set: (fn) => {
                handler = fn;
                accessor.set.call(this, typeof fn === "function" ? (event) => {
                  if (!filterLoaded) {
                    if (held.length < 5000)
                      held.push(() => fn.call(this, forViewer(event)));
                    return;
                  }
                  fn.call(this, forViewer(event));
                } : fn);
              } });
            }
            const names = new Map, seenChat = new Set, faces = new Map, npcs = new Map, playerHp = new Map;
            let publishedOpponent = "null";
            const hp = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n)) ? [v[0], v[1]] : void 0, mask = (value) => {
              for (const name of hiddenNames)
                value = value.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "\u27E6MAIN\u27E7");
              return value;
            };
            this.addEventListener("message", (raw) => {
              const event = fullRoster(raw);
              if (typeof event.data !== "string" || event.data.length > 2000000)
                return;
              let message;
              try {
                message = JSON.parse(event.data);
              } catch {
                return;
              }
              if (message.t === "roster" && Array.isArray(message.p)) {
                for (const p of message.p)
                  if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "string")
                    names.set(p[0], p[1]);
                const sendRoster = () => host.parent.postMessage({ atlasRoster: { players: message.p.filter((p) => Array.isArray(p) && typeof p[1] === "string" && [p[2], p[3], p[4], p[5]].every(Number.isFinite)).map((p) => [hiddenHashes.has(fnv(p[1].toLowerCase())) ? "\u27E6MAIN\u27E7" : mask(p[1]), p[2], p[3], p[4], p[5]]) } }, host.location.origin);
                if (host.parent !== host && !failed)
                  if (privacyReady && renderReady)
                    sendRoster();
                  else {
                    heldRoster = sendRoster;
                    heldRosterAt = Date.now();
                  }
              }
              if (message.t === "tick") {
                if (message.reset) {
                  faces.clear();
                  npcs.clear();
                  playerHp.clear();
                }
                for (const r of Array.isArray(message.p) ? message.p : []) {
                  if (typeof r?.i !== "number")
                    continue;
                  if (r.f) {
                    faces.delete(r.i);
                    playerHp.delete(r.i);
                  }
                  if (typeof r.fe === "number")
                    r.fe < 0 ? faces.delete(r.i) : faces.set(r.i, r.fe);
                  const h = hp(r.hp);
                  if (h)
                    playerHp.set(r.i, h);
                }
                for (const r of Array.isArray(message.n) ? message.n : []) {
                  if (typeof r?.i !== "number")
                    continue;
                  const e = r.f ? {} : npcs.get(r.i) ?? {};
                  if (typeof r.t === "number")
                    e.t = r.t;
                  const h = hp(r.hp);
                  if (h)
                    e.hp = h;
                  npcs.set(r.i, e);
                }
                for (const i of Array.isArray(message.rp) ? message.rp : []) {
                  faces.delete(i);
                  playerHp.delete(i);
                }
                for (const i of Array.isArray(message.rn) ? message.rn : [])
                  npcs.delete(i);
                if (privacyReady && renderReady && !failed && host.parent !== host) {
                  const follow = new host.URL(host.location.href).searchParams.get("follow")?.toLowerCase();
                  let slot;
                  if (follow) {
                    for (const [i, n] of names)
                      if (n.toLowerCase() === follow) {
                        slot = i;
                        break;
                      }
                  }
                  const fe = slot == null ? void 0 : faces.get(slot);
                  let opponent = null;
                  if (fe != null && fe >= 32768) {
                    const h = playerHp.get(fe - 32768), n = names.get(fe - 32768);
                    if (h && n)
                      opponent = { kind: "player", name: mask(n), hp: h };
                  } else if (fe != null) {
                    const e = npcs.get(fe);
                    if (e?.hp && e.t != null)
                      opponent = { kind: "npc", type: e.t, hp: e.hp };
                  }
                  const key = JSON.stringify(opponent);
                  if (key !== publishedOpponent) {
                    publishedOpponent = key;
                    host.parent.postMessage({ atlasOpponent: opponent }, host.location.origin);
                  }
                }
              }
              if (message.t !== "tick" || !Array.isArray(message.p) || !privacyReady || !renderReady || failed || host.parent === host)
                return;
              for (const p of message.p) {
                if (typeof p.ch !== "string" || typeof p.i !== "number" || !names.has(p.i))
                  continue;
                const key = String(message.k) + ":" + p.i + ":" + p.ch;
                if (seenChat.has(key))
                  continue;
                seenChat.add(key);
                if (seenChat.size > 500)
                  seenChat.delete(seenChat.values().next().value);
                host.parent.postMessage({ atlasChat: { key: mask(key), name: mask(names.get(p.i)), text: mask(p.ch).slice(0, 500) } }, host.location.origin);
              }
            });
          }
        } catch {}
      }
    };
  let pageFollow = "", pageFollowPolls = 0;
  const releaseFollow = () => {
    const button = host.document?.querySelector(".live-follow button");
    if (!button)
      return !1;
    button.click();
    freeCameraPolls = 0;
    const url = new host.URL(host.location.href);
    publishedFollow = url.searchParams.get("follow");
    if (host.history?.replaceState) {
      url.searchParams.delete("follow");
      host.history.replaceState(host.history.state, "", url.href);
      publishedFollow = null;
    }
    return !0;
  };
  let multiAsked = [], multiDown = null, multiHover = -1;
  const multiName = (n) => typeof n === "string" && (n === "\u27E6MAIN\u27E7" || /^[A-Za-z0-9_-](?:[A-Za-z0-9_ -]{0,10}[A-Za-z0-9_-])?$/.test(n)), validMulti = (list) => Array.isArray(list) && list.length <= 16 && list.every(multiName) && new Set(list.map((n) => n.toLowerCase())).size === list.length, multiView = (v) => multiName(v) || Number.isInteger(v) && v >= 0 && v < 16, multiShares = (v) => Array.isArray(v) && v.length <= 16 && v.every((n) => typeof n === "number" && n > 0 && n <= 1), layoutRules = { rows: multiShares, cols: multiShares, strip: (v) => v === 0 || typeof v === "number" && v >= 0.1 && v <= 0.45, mode: (v) => ["grid", "main", "focus", "columns"].includes(v), main: multiView, gap: (v) => Number.isInteger(v) && v >= 0 && v <= 24, ratio: (v) => typeof v === "number" && v >= 0.5 && v <= 0.8, animate: (v) => typeof v === "boolean", color: (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) }, multiRules = {
    multi: validMulti,
    multiOrder: validMulti,
    multiDistance: (v) => Number.isInteger(v) && v >= 16 && v <= 128,
    multiFocus: multiView,
    multiChrome: (v) => typeof v === "boolean",
    multiLayout: (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => Object.hasOwn(layoutRules, k) && layoutRules[k](v[k]))
  };
  host.addEventListener("message", (event) => {
    const data = event.data, keys = data && typeof data === "object" ? Object.keys(multiRules).filter((k) => (k in data)) : [];
    if (keys.length) {
      if (!(event.origin === host.location.origin && event.source === host.parent) || keys.some((k) => !multiRules[k](data[k]))) {
        event.stopImmediatePropagation();
        return;
      }
      if ("multi" in data) {
        multiAsked = data.multi.slice();
        multiHover = -1;
      }
      if ("multiOrder" in data) {
        const left = multiAsked.slice(), first = [];
        for (const n of data.multiOrder) {
          const i = left.findIndex((a) => a.toLowerCase() === n.toLowerCase());
          if (i >= 0)
            first.push(left.splice(i, 1)[0]);
        }
        multiAsked = [...first, ...left];
      }
    }
    if (event.origin !== host.location.origin || event.source !== host.parent || !event.data || typeof event.data !== "object")
      return;
    if ("botGround" in event.data) {
      const rows = event.data.botGround;
      if (Array.isArray(rows) && rows.length <= 1000 && rows.every(groundRow)) {
        botGround = rows.map((r) => r.slice());
        groundVersion++;
      }
    }
    if (event.data.atlasCompass === !0)
      host.document?.querySelector(".minimap-container .compass")?.click();
    if (event.data.atlasOpenWorldMap === !0)
      host.document?.querySelector(".minimap-container .worldmap-icon")?.click();
    if (typeof event.data.follow === "string") {
      freeCameraPolls = 0;
      publishedFollow = new host.URL(host.location.href).searchParams.get("follow");
      pageFollow = event.data.follow.toLowerCase();
      pageFollowPolls = 20;
    }
    if (event.data.atlasFreeCamera === !0) {
      freeCameraPolls = 10;
      pageFollow = "";
      releaseFollow();
    }
  });
  const paneAt = (event) => {
    const panes = [...host.document?.querySelectorAll?.(".multi-view .multi-pane[data-pane]") ?? []];
    if (event.target?.tagName !== "CANVAS" || panes.length !== multiAsked.length)
      return -1;
    let hit = -1, top = -1;
    for (const p of panes) {
      const r = p.getBoundingClientRect(), i = Number(p.dataset?.pane), z = Number(p.style?.zIndex) || 0;
      if (event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom && Number.isInteger(i) && i >= 0 && i < multiAsked.length && z >= top) {
        hit = i;
        top = z;
      }
    }
    return hit;
  }, hover = (pane) => {
    if (pane === multiHover)
      return;
    multiHover = pane;
    if (privacyReady && renderReady && !failed && host.parent !== host)
      host.parent.postMessage({ viewerMultiHover: pane }, host.location.origin);
  };
  host.addEventListener("pointermove", (event) => {
    if (multiAsked.length)
      hover(paneAt(event));
  }, !0);
  host.addEventListener("pointerout", (event) => {
    if (multiAsked.length && !event.relatedTarget)
      hover(-1);
  }, !0);
  if (url.searchParams.get("embed") !== "1") {
    host.addEventListener("pointerdown", (event) => {
      multiDown = multiAsked.length && event.button === 0 ? { x: event.clientX, y: event.clientY, pane: paneAt(event) } : null;
    }, !0);
    host.addEventListener("pointerup", (event) => {
      const down = multiDown;
      multiDown = null;
      if (!down || down.pane < 0 || down.pane !== paneAt(event) || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8)
        return;
      if (!privacyReady || !renderReady || failed || host.parent === host)
        return;
      const name = multiAsked[down.pane];
      host.parent.postMessage({ viewerMultiPick: hiddenNames.has(name.toLowerCase()) ? "\u27E6MAIN\u27E7" : name, index: down.pane }, host.location.origin);
    }, !0);
  }
  host.addEventListener("keydown", (event) => {
    const wallKey = !event.ctrlKey && !event.altKey && !event.metaKey && !/^(?:INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName ?? "") && typeof event.key === "string" && (event.key === "\\" || multiAsked.length > 0 && /^(?:Arrow(?:Left|Right|Up|Down)|[hjklfHJKLF1-9? ]|Enter|Escape)$/.test(event.key));
    if (event.key !== "[" && event.key !== "]" && !wallKey)
      return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (host.parent === host)
      return;
    if (wallKey)
      host.parent.postMessage({ atlasWallKey: { key: event.key, shift: !!event.shiftKey } }, host.location.origin);
    else
      host.parent.postMessage({ atlasStep: event.key === "]" ? 1 : -1 }, host.location.origin);
  }, !0);
  host.addEventListener("error", () => fail("The 3D viewer reported an error; use the 2D map."));
  host.document?.addEventListener?.("webglcontextlost", () => fail("The 3D view lost its graphics context."), !0);
  host.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.name !== "AbortError")
      fail("The 3D viewer could not finish loading; use the 2D map.");
  });
  host.setInterval?.(() => {
    if (!privacyReady || !renderReady || failed || host.parent === host)
      return;
    if (freeCameraPolls) {
      if (releaseFollow())
        return;
      if (!new host.URL(host.location.href).searchParams.get("follow"))
        freeCameraPolls = 0;
      else if (--freeCameraPolls === 0)
        fail("The 3D follow could not stop. Use the 2D map.");
      return;
    }
    const worldMap = !!host.document?.querySelector(".worldmap-modal-overlay");
    if (worldMap !== publishedWorldMap) {
      publishedWorldMap = worldMap;
      host.parent.postMessage({ atlasWorldMap: worldMap }, host.location.origin);
    }
    const params = new host.URL(host.location.href).searchParams, cx = Number(params.get("cx")), cz = Number(params.get("cz")), yaw = Number(params.get("y"));
    if (params.has("cx") && Number.isFinite(cx) && Number.isFinite(cz) && Number.isFinite(yaw)) {
      const key = cx + "," + cz + "," + yaw;
      if (key !== publishedCamera) {
        publishedCamera = key;
        host.parent.postMessage({ atlasCamera3d: { x: cx, z: cz, yaw: yaw & 2047 } }, host.location.origin);
      }
    }
    const follow = params.get("follow");
    if (multiAsked.length) {
      publishedFollow = follow;
      return;
    }
    if (pageFollowPolls) {
      if (follow?.toLowerCase() === pageFollow) {
        pageFollowPolls = 0;
        publishedFollow = follow;
        return;
      }
      if (--pageFollowPolls)
        return;
    }
    if (!follow || follow === publishedFollow || !/^[A-Za-z0-9_ -]{1,12}$/.test(follow))
      return;
    publishedFollow = follow;
    if (follow.toLowerCase() === pageFollow)
      return;
    host.parent.postMessage({ atlasFollow: hiddenNames.has(follow.toLowerCase()) ? "\u27E6MAIN\u27E7" : follow }, host.location.origin);
  }, 500);
})(window);