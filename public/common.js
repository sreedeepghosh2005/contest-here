'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { return null; }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtMs(ms) {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return (h ? h + ':' + pad(m) : m) + ':' + pad(sec);
}

function verdictPill(v) {
  const cls = v === 'Accepted' || v === 'Passed' ? 'ok' : v === 'Time Limit Exceeded' ? 'warn' : 'bad';
  return `<span class="pill ${cls}">${esc(v)}</span>`;
}

const LANGS = {
  python: { label: 'Python 3', mode: 'python',
    starter: 'import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # write your solution here\n\nmain()\n' },
  c: { label: 'C', mode: 'text/x-csrc',
    starter: '#include <stdio.h>\n\nint main(void) {\n    // write your solution here\n    return 0;\n}\n' },
  cpp: { label: 'C++', mode: 'text/x-c++src',
    starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // write your solution here\n    return 0;\n}\n' },
  java: { label: 'Java', mode: 'text/x-java',
    starter: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // write your solution here\n    }\n}\n' },
};
