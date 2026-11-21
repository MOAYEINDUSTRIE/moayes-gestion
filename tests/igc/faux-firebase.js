// Faux Firebase en mémoire, chargé à la place de vendor/firebase-*-compat.js pendant les tests.
// Reproduit ce qu'utilise IGC Gestion : app nommée, auth (compte connecté), ref/child/on/off/once/set/update,
// orderByKey/limitToLast/endAt, événements value et child_added/changed/removed, refus de permission.
(function () {
  const F = window.__FB = window.__FB || {};
  F.arbre = F.arbre || JSON.parse(JSON.stringify(window.__FB_INIT || {}));
  F.ecritures = []; F.ecouteurs = []; F.refus = window.__FB_REFUS ? new RegExp(window.__FB_REFUS) : null;
  const parts = p => String(p || '').split('/').filter(Boolean);
  const copie = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
  function nettoie(v) {             // Firebase ne garde ni null ni objet vide
    if (Array.isArray(v)) v = Object.assign({}, v);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) { const x = nettoie(v[k]); if (x !== null) o[k] = x; } return Object.keys(o).length ? o : null; }
    return v === undefined ? null : v;
  }
  function lire(p) { let n = F.arbre; for (const k of parts(p)) { if (!n || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : copie(n); }
  function poser(p, v) {
    const ks = parts(p); v = nettoie(copie(v));
    if (!ks.length) { F.arbre = v || {}; return; }
    let n = F.arbre; for (const k of ks.slice(0, -1)) { if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
    const d = ks[ks.length - 1]; if (v === null) delete n[d]; else n[d] = v;
    // supprime les parents devenus vides
    if (v === null) for (let i = ks.length - 1; i > 0; i--) { const par = lire(ks.slice(0, i).join('/')); if (par && Object.keys(par).length) break; let m = F.arbre; for (const k of ks.slice(0, i - 1)) m = m[k]; if (m) delete m[ks[i - 1]]; }
  }
  const snap = (p, v) => ({ key: parts(p).pop() || null, val: () => copie(v), exists: () => v !== null && v !== undefined });
  function notifier(avant, vus) {
    for (const e of F.ecouteurs.slice()) {
      if (!vus.includes(e.p)) continue;
      const v0 = avant(e.p), v1 = lire(e.p);
      if (e.ev === 'value') { if (JSON.stringify(v0) !== JSON.stringify(v1)) e.cb(snap(e.p, v1)); continue; }
      const a = v0 || {}, b = v1 || {};
      for (const k in b) { if (!(k in a) && e.ev === 'child_added') e.cb(snap(e.p + '/' + k, b[k])); else if (k in a && JSON.stringify(a[k]) !== JSON.stringify(b[k]) && e.ev === 'child_changed') e.cb(snap(e.p + '/' + k, b[k])); }
      if (e.ev === 'child_removed') for (const k in a) if (!(k in b)) e.cb(snap(e.p + '/' + k, a[k]));
    }
  }
  function ecrire(fn, chemins) {
    const vus = [...new Set(F.ecouteurs.map(e => e.p))].filter(p => chemins.some(c => c === p || c.startsWith(p + '/') || p.startsWith(c + '/')));
    const photo = new Map(vus.map(p => [p, lire(p)])); fn();
    setTimeout(() => notifier(p => photo.has(p) ? photo.get(p) : lire(p), vus), 0);
  }
  const refuse = p => F.refus && F.refus.test(p);
  const erreurRefus = () => Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
  F.ecrire = (p, v) => ecrire(() => poser(p, v), [parts(p).join('/')]);            // écriture « d'un autre appareil »
  F.lire = lire;
  function Ref(p, q) {
    this.path = parts(p).join('/'); this.q = q || {}; this.key = parts(p).pop() || null;
  }
  Ref.prototype.child = function (c) { return new Ref(this.path + '/' + c); };
  Ref.prototype.orderByKey = function () { return new Ref(this.path, Object.assign({}, this.q, { ok: 1 })); };
  Ref.prototype.limitToLast = function (n) { return new Ref(this.path, Object.assign({}, this.q, { last: n })); };
  Ref.prototype.endAt = function (k) { return new Ref(this.path, Object.assign({}, this.q, { fin: k })); };
  Ref.prototype._val = function () {
    let v = lire(this.path); if (!v || typeof v !== 'object' || (!this.q.last && !this.q.fin)) return v;
    let ks = Object.keys(v).sort(); if (this.q.fin) ks = ks.filter(k => k <= this.q.fin); if (this.q.last) ks = ks.slice(-this.q.last);
    const o = {}; ks.forEach(k => o[k] = v[k]); return ks.length ? o : null;
  };
  Ref.prototype.on = function (ev, cb, err) {
    if (refuse(this.path)) { setTimeout(() => err && err(erreurRefus()), 0); return cb; }
    const e = { p: this.path, ev, cb, ref: this }; F.ecouteurs.push(e);
    setTimeout(() => { const v = this._val(); if (ev === 'value') cb(snap(this.path, v)); else if (ev === 'child_added' && v) Object.keys(v).sort().forEach(k => cb(snap(this.path + '/' + k, v[k]))); }, 0);
    return cb;
  };
  Ref.prototype.off = function () { F.ecouteurs = F.ecouteurs.filter(e => e.p !== this.path); };
  Ref.prototype.once = function (ev, cb) {
    return new Promise((ok, ko) => setTimeout(() => { if (refuse(this.path)) return ko(erreurRefus()); const s = snap(this.path, this._val()); if (cb) cb(s); ok(s); }, 0));
  };
  Ref.prototype.set = function (v) { if (refuse(this.path)) return Promise.reject(erreurRefus()); F.ecritures.push({ type: 'set', p: this.path, v: copie(v) }); ecrire(() => poser(this.path, v), [this.path]); return Promise.resolve(); };
  Ref.prototype.update = function (o) {
    if (refuse(this.path)) return Promise.reject(erreurRefus());
    F.ecritures.push({ type: 'update', p: this.path, v: copie(o), octets: JSON.stringify(o).length });
    ecrire(() => { for (const k in o) poser(this.path + '/' + k, o[k]); }, Object.keys(o).map(k => this.path + '/' + k)); return Promise.resolve();
  };
  const utilisateur = { email: 'impactglobalconsulting11@gmail.com', isAnonymous: false, uid: 'test' };
  const auth = {
    get currentUser() { return F.deconnecte ? null : utilisateur; },
    onAuthStateChanged(cb) { setTimeout(() => cb(F.deconnecte ? null : utilisateur), 0); return () => {}; },
    signInWithEmailAndPassword() { F.deconnecte = false; return Promise.resolve({ user: utilisateur }); },
    signOut() { F.deconnecte = true; return Promise.resolve(); },
    sendPasswordResetEmail() { return Promise.resolve(); }
  };
  const apps = {};
  const db = { ref: p => new Ref(p) };
  window.firebase = {
    app(n) { if (!apps[n]) throw new Error('pas d\'app'); return apps[n]; },
    initializeApp(cfg, n) { return apps[n] = { name: n, auth: () => auth, database: () => db }; }
  };
})();
