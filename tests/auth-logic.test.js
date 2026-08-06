const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// gate-tilakone
assert(w.resolveAuthGate(null, null) === 'auth', 'ei sessiota → auth');
assert(w.resolveAuthGate({ user:{ id:'x' } }, null) === 'link', 'sessio, ei pelaajaa → link');
assert(w.resolveAuthGate({ user:{ id:'x' } }, { id:'a:b' }) === 'app', 'sessio + pelaaja → app');

// email
assert(w.validateEmail('a@b.co') === true, 'kelpo email');
assert(w.validateEmail('roska') === false, 'kelvoton email');
assert(w.validateEmail('') === false, 'tyhjä email');

// rekisteröinnin validointi — uusi pelaaja
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'new', nick:'Aa', city:'Bb' }).ok === true, 'kelpo uusi');
assert(w.validateRegForm({ email:'a@b.co', password:'123', code:'x', mode:'new', nick:'Aa', city:'Bb' }).ok === false, 'liian lyhyt salasana');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'', mode:'new', nick:'Aa', city:'Bb' }).ok === false, 'puuttuva koodi');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'new', nick:'A', city:'Bb' }).ok === false, 'liian lyhyt nimi');

// rekisteröinnin validointi — linkitys
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'link', playerId:'a:b' }).ok === true, 'kelpo linkitys');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'link', playerId:'' }).ok === false, 'linkitys ilman valintaa');
