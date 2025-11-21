// Minimal frontend to demo register/login/upload/list
const api = (path, opts = {}) => fetch(path, opts).then(r => r.json().catch(()=>({})));

const setMsg = msg => document.getElementById('message').textContent = msg || '';

let token = null;
const showUpload = () => {
  document.getElementById('uploadSection').style.display = token ? 'block' : 'none';
};

document.getElementById('regBtn').onclick = async () => {
  const u = document.getElementById('regUser').value;
  const p = document.getElementById('regPass').value;
  const res = await api('/api/register', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username: u, password: p })});
  setMsg(JSON.stringify(res));
};

document.getElementById('logBtn').onclick = async () => {
  const u = document.getElementById('logUser').value;
  const p = document.getElementById('logPass').value;
  const res = await api('/api/login', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username: u, password: p })});
  if (res.token) {
    token = res.token;
    setMsg('Logged in');
    showUpload();
    loadFiles();
  } else {
    setMsg(JSON.stringify(res));
  }
};

document.getElementById('uploadBtn').onclick = async () => {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return setMsg('Select a file');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method:'POST', body: fd, headers: { 'Authorization': 'Bearer ' + token }});
  const json = await res.json();
  setMsg(JSON.stringify(json));
  loadFiles();
};

async function loadFiles() {
  const res = await fetch('/api/files', { headers: { 'Authorization': 'Bearer ' + token } });
  const json = await res.json();
  const ul = document.getElementById('filesList');
  ul.innerHTML = '';
  if (Array.isArray(json)) {
    json.forEach(f => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = f.original_name;
      a.href = '/api/files/' + f.id;
      a.target = '_blank';
      li.appendChild(a);
      ul.appendChild(li);
    });
  } else {
    setMsg(JSON.stringify(json));
  }
}

showUpload();
