/* ==========================================================================
   Inline pixel boot script.
   Returns the IIFE source that:
     1. Loads fbevents.js
     2. Resolves external_id (server-injected → localStorage → cookie → UUID)
     3. Captures fbclid → _fbc cookie
     4. Initializes each pixel
     5. Installs window.__ZARAZ_TRACK__ readiness queue (5s cap)
     6. Fires deduplicated PageView (fbq + Zaraz)
     7. Sets window.__META_FIRST_PAGEVIEW_DONE__ = true (SPA listeners use this)

   Used by both the React component (Next/CRA) and the Astro component.
   Inject via <script>{html}</script> with `dangerouslySetInnerHTML` /
   `set:html`.
   ========================================================================== */

export function buildPixelInitScript(
  pixelIds: string[],
  debug: boolean,
): string {
  const idsJson = JSON.stringify(pixelIds);
  const debugBool = debug ? "true" : "false";

  return `
(function () {
  window.__META_DEBUG__ = ${debugBool};
  window.__META_PIXEL_IDS__ = ${idsJson};

  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }
  function setCookie(name, value, days) {
    var e = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + e + ";path=/;SameSite=Lax";
  }
  function genId(name) {
    return name + "_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
  }
  function getExternalId() {
    var id = window.__EXTERNAL_ID__ || null;
    if (!id) { try { id = localStorage.getItem("meta_external_id"); } catch (e) {} }
    if (!id) id = getCookie("meta_external_id");
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : "v_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
    }
    try { localStorage.setItem("meta_external_id", id); } catch (e) {}
    setCookie("meta_external_id", id, 365);
    return id;
  }

  var fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid && !getCookie("_fbc")) setCookie("_fbc", "fb.1.0." + fbclid, 90);

  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  var externalId = getExternalId();
  var pixelIds = ${idsJson};
  for (var i = 0; i < pixelIds.length; i++) {
    fbq("init", pixelIds[i], { external_id: externalId });
  }

  var q = [], ready = false, waited = 0;
  function flush() {
    for (var i = 0; i < q.length; i++) {
      try { window.zaraz.track(q[i].name, q[i].payload); } catch (e) {}
    }
    q.length = 0;
  }
  function zarazTrack(name, payload) {
    if (ready) { try { window.zaraz.track(name, payload); } catch (e) {} return; }
    q.push({ name: name, payload: payload });
  }
  (function poll() {
    if (typeof window.zaraz !== "undefined" && typeof window.zaraz.track === "function") {
      ready = true; flush(); return;
    }
    if (waited >= 5000) return;
    waited += 50; setTimeout(poll, 50);
  })();
  window.__ZARAZ_TRACK__ = zarazTrack;

  var pvId = genId("PageView");
  fbq("track", "PageView", {}, { eventID: pvId });
  zarazTrack("PageView", {
    event_id: pvId,
    external_id: externalId,
    fbc: getCookie("_fbc") || "",
    fbp: getCookie("_fbp") || ""
  });

  window.__META_FIRST_PAGEVIEW_DONE__ = true;
})();
`;
}
