#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.eventListeners = new Map();
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.id = '';
    this.textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    this.value = '';
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(newNode, referenceNode) {
    newNode.parentElement = this;
    const idx = referenceNode ? this.children.indexOf(referenceNode) : -1;
    if (idx === -1) {
      this.children.push(newNode);
    } else {
      this.children.splice(idx, 0, newNode);
    }
    return newNode;
  }

  remove() {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx >= 0) this.parentElement.children.splice(idx, 1);
    this.parentElement = null;
  }

  addEventListener(eventName, handler) {
    if (!this.eventListeners.has(eventName)) this.eventListeners.set(eventName, []);
    this.eventListeners.get(eventName).push(handler);
  }

  querySelector(selector) {
    if (selector === '.restart') {
      return this.children.find((child) => child.className === 'restart') || null;
    }
    if (selector === 'fieldset') {
      return null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === 'button') {
      return this.children.filter((child) => child.tagName === 'BUTTON');
    }
    return [];
  }

  matches(selector) {
    if (selector === 'input[type="radio"][data-qid]') return false;
    return false;
  }

  replaceWith(nextElement) {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx === -1) return;
    nextElement.parentElement = this.parentElement;
    this.parentElement.children[idx] = nextElement;
    this.parentElement = null;
  }
}

function setupDom() {
  const document = {
    _idMap: new Map(),
    body: new Element('body', null),
    createElement(tagName) {
      return new Element(tagName, document);
    },
    getElementById(id) {
      return document._idMap.get(id) || null;
    },
    querySelector() {
      return null;
    }
  };
  document.body.ownerDocument = document;

  const appRoot = document.createElement('main');
  appRoot.id = 'app-root';
  document.body.appendChild(appRoot);

  const progress = document.createElement('div');
  progress.id = 'progress';
  appRoot.appendChild(progress);

  const questions = document.createElement('section');
  questions.id = 'questions';
  appRoot.appendChild(questions);

  const nav = document.createElement('nav');
  nav.id = 'nav';
  appRoot.appendChild(nav);

  const result = document.createElement('section');
  result.id = 'result';
  appRoot.appendChild(result);

  for (const node of [progress, questions, nav, result]) {
    document._idMap.set(node.id, node);
  }

  return { document, progress, questions, nav, result, appRoot };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body;
    }
  };
}

function assertDebugHintIncludes(message, { endpoint, status, bodyHint = false }) {
  assert.ok(message.includes(endpoint), `Expected endpoint hint \"${endpoint}\" in: ${message}`);
  assert.ok(message.includes(`status: ${status}`), `Expected status hint ${status} in: ${message}`);
  if (bodyHint) {
    assert.ok(message.includes('Hint: API-body is geen geldige JSON.'), `Expected invalid body hint in: ${message}`);
  }
}

async function runScenario(name) {
  const { document, progress, questions, appRoot } = setupDom();
  const notices = [];
  const errors = [];

  const localStorage = {
    _store: new Map(),
    getItem(key) {
      return this._store.has(key) ? this._store.get(key) : null;
    },
    setItem(key, value) {
      this._store.set(key, String(value));
    },
    removeItem(key) {
      this._store.delete(key);
    }
  };

  const timeouts = [];

  globalThis.window = {
    APP_ENV: 'development',
    setTimeout(fn) {
      timeouts.push(fn);
      return timeouts.length;
    },
    clearTimeout() {},
    scrollTo() {},
    console
  };
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.fetch = async (url) => {
    if (url === 'api/v1/get_progress.php') {
      return response('[]');
    }

    if (url.startsWith('api/v1/get_questions.php')) {
      if (name === 'case_a') {
        return response(JSON.stringify({
          questions: [{ id: 1, text: 'Vraag 1?' }],
          page: 1,
          per_page: 10,
          total: 1
        }));
      }

      if (name === 'case_b') {
        return response('{"questions": [invalid json');
      }

      if (name === 'case_c') {
        return response(JSON.stringify({ page: 1, per_page: 10, total: 1 }));
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const originalConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args);
  };

  const originalInsertBefore = appRoot.insertBefore.bind(appRoot);
  appRoot.insertBefore = (newNode, referenceNode) => {
    if (newNode.className === 'error-notice') {
      notices.push(newNode);
    }
    return originalInsertBefore(newNode, referenceNode);
  };

  const appModulePath = pathToFileURL(path.resolve('assets/app.js')).href;
  await import(appModulePath + `?scenario=${name}&ts=${Date.now()}`);
  await new Promise((resolve) => setImmediate(resolve));

  console.error = originalConsoleError;

  if (name === 'case_a') {
    assert.equal(notices.length, 0, 'Valid payload should not trigger error notice');
    assert.equal(errors.length, 0, 'Valid payload should not log load error');
    assert.equal(questions.children.length, 1, 'Valid payload should render one question row');
    return;
  }

  assert.ok(errors.length > 0, 'Bad payload should trigger explicit error logging path');
  assert.ok(notices.length > 0, 'Bad payload should trigger explicit showError path');
  assert.equal(questions.children.length, 0, 'Bad payload should not silently render questions');

  const finalMessage = notices.at(-1)?.textContent || '';
  assert.ok(finalMessage.includes('Fout bij laden.'), 'Expected base load failure text in development notice');

  if (name === 'case_b') {
    assertDebugHintIncludes(finalMessage, {
      endpoint: 'api/v1/get_questions.php?page=1&per_page=10',
      status: 200,
      bodyHint: true
    });
  }

  if (name === 'case_c') {
    assertDebugHintIncludes(finalMessage, {
      endpoint: 'api/v1/get_questions.php?page=1&per_page=10',
      status: 200,
      bodyHint: false
    });
  }
}

const scenario = process.argv[2];
if (!scenario || !['case_a', 'case_b', 'case_c'].includes(scenario)) {
  throw new Error('Usage: node tests/frontend_runtime_flow_test.mjs <case_a|case_b|case_c>');
}

await runScenario(scenario);
console.log(`Runtime scenario ${scenario} passed`);
