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
    this.attributes = new Map();
    this.classList = {
      add: (...classes) => {
        const next = new Set(this.className.split(' ').filter(Boolean));
        classes.forEach((className) => next.add(className));
        this.className = Array.from(next).join(' ');
      },
      remove: (...classes) => {
        const next = new Set(this.className.split(' ').filter(Boolean));
        classes.forEach((className) => next.delete(className));
        this.className = Array.from(next).join(' ');
      },
      toggle: (className, force) => {
        const hasClass = this.className.split(' ').filter(Boolean).includes(className);
        const shouldHaveClass = force === undefined ? !hasClass : Boolean(force);
        if (shouldHaveClass) {
          this.classList.add(className);
          return true;
        }
        this.classList.remove(className);
        return false;
      }
    };
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

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      return this.ownerDocument.getElementById(selector.slice(1));
    }
    if (selector === '.restart') {
      return this.children.find((child) => child.className === 'restart') || null;
    }
    if (selector === 'fieldset') {
      return null;
    }
    if (selector === '.modal-go-back' || selector === '.modal-continue' || selector === '[data-modal-close="true"]') {
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
    querySelector(selector) {
      if (selector === '[data-app-env]') return document.body;
      if (selector === '#nav .submit') {
        const nav = document.getElementById('nav');
        return nav?.children.find((child) => child.className.split(' ').includes('submit')) || null;
      }
      if (selector === 'main.container') {
        return document.getElementById('app-root');
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#nav button, #result .restart, #delete-data-start, #recovery-toggle, #recovery-request, #recovery-email, #questions input, #questions button') {
        return [];
      }
      return [];
    }
  };
  document.body.ownerDocument = document;
  document.body.dataset.appEnv = 'development';

  const appRoot = document.createElement('main');
  appRoot.id = 'app-root';
  appRoot.className = 'container';
  document.body.appendChild(appRoot);

  const questionScreen = document.createElement('section');
  questionScreen.id = 'question-screen';
  appRoot.appendChild(questionScreen);

  const resultsScreen = document.createElement('section');
  resultsScreen.id = 'results-screen';
  appRoot.appendChild(resultsScreen);

  const progress = document.createElement('div');
  progress.id = 'progress';
  questionScreen.appendChild(progress);

  const questions = document.createElement('section');
  questions.id = 'questions';
  questionScreen.appendChild(questions);

  const nav = document.createElement('nav');
  nav.id = 'nav';
  questionScreen.appendChild(nav);

  const result = document.createElement('section');
  result.id = 'result';
  resultsScreen.appendChild(result);

  const testMeta = document.createElement('p');
  testMeta.id = 'test-meta';
  questionScreen.appendChild(testMeta);

  for (const node of [progress, questions, nav, result, appRoot, questionScreen, resultsScreen, testMeta]) {
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

function delayedAbortResponse(signal) {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      reject(abortError);
    }, { once: true });
  });
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
  let saveAnswerCalls = 0;

  const noop = () => {};
  globalThis.HTMLElement = Element;
  globalThis.HTMLButtonElement = Element;
  globalThis.HTMLInputElement = Element;
  globalThis.window = {
    APP_ENV: 'development',
    setTimeout(fn) {
      timeouts.push(fn);
      return timeouts.length;
    },
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    scrollTo: noop,
    confirm: () => true,
    console,
    history: { replaceState: noop },
    location: { search: '', pathname: '/', hash: '' }
  };
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.fetch = async (url, options = {}) => {
    if (url === 'api/v1/get_progress.php') {
      return response('[]');
    }

    if (url === 'api/v1/test_metadata.php') {
      return response(JSON.stringify({ version: '2026.03', date: '2026-03-18', question_count: 1 }));
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

      if (name === 'case_timeout') {
        return delayedAbortResponse(options.signal);
      }

      if (name === 'case_unsynced_submit') {
        return response(JSON.stringify({
          questions: [{ id: 1, text: 'Vraag 1?' }],
          page: 1,
          per_page: 10,
          total: 1
        }));
      }
    }

    if (url === 'api/v1/submit_results.php') {
      if (name === 'case_unsynced_submit' && saveAnswerCalls < 2) {
        return response(JSON.stringify({ message: 'Incomplete test', answered: 0, total: 1 }), 422);
      }
      return response(JSON.stringify({ type: 'INTJ' }));
    }

    if (url === 'api/v1/save_answer.php') {
      if (name === 'case_unsynced_submit' && saveAnswerCalls === 0) {
        saveAnswerCalls += 1;
        return response(JSON.stringify({ message: 'save failed' }), 500);
      }
      saveAnswerCalls += 1;
      return response(JSON.stringify({ ok: true }));
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const originalConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args);
  };

  const originalAppendChild = document.body.appendChild.bind(document.body);
  document.body.appendChild = (newNode) => {
    if (newNode.className === 'error-notice') {
      notices.push(newNode);
    }
    return originalAppendChild(newNode);
  };

  const appModulePath = pathToFileURL(path.resolve('assets/app.js')).href;
  if (name === 'case_unsynced_submit') {
    localStorage.setItem('personality.answers.v1', JSON.stringify({ 1: 4 }));
    localStorage.setItem('personality.pendingRetries.v1', JSON.stringify({ 1: true }));
  }
  await import(appModulePath + `?scenario=${name}&ts=${Date.now()}`);
  await new Promise((resolve) => setImmediate(resolve));
  if (name === 'case_timeout' || name === 'case_unsynced_submit') {
    while (timeouts.length > 0) {
      const timeoutFn = timeouts.shift();
      if (typeof timeoutFn === 'function') timeoutFn();
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  console.error = originalConsoleError;

  if (name === 'case_a') {
    assert.equal(notices.length, 0, 'Valid payload should not trigger error notice');
    assert.equal(errors.length, 0, 'Valid payload should not log load error');
    assert.ok(questions.children.length >= 1, 'Valid payload should render at least one question row');
    return;
  }

  if (name === 'case_unsynced_submit') {
    const nav = document.getElementById('nav');
    const submitButton = document.querySelector('#nav .submit')
      || nav?.children.find((child) => child.tagName === 'BUTTON')
      || null;
    assert.ok(submitButton, 'Submit button should render on last page');
    const initialSubmitHandler = submitButton.eventListeners.get('click')?.[0];
    if (!submitButton.disabled && typeof initialSubmitHandler === 'function') {
      await initialSubmitHandler({ preventDefault() {} });
    }

    while (timeouts.length > 0) {
      const timeoutFn = timeouts.shift();
      if (typeof timeoutFn === 'function') timeoutFn();
      await new Promise((resolve) => setImmediate(resolve));
    }

    assert.equal(submitButton.disabled, false, 'Submit should be enabled after retry sync succeeds');
    const submitHandler = submitButton.eventListeners.get('click')?.[0];
    assert.equal(typeof submitHandler, 'function', 'Submit click handler should be attached');
    await submitHandler({ preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));

    const resultsScreen = document.getElementById('results-screen');
    assert.equal(resultsScreen?.hidden, false, 'Submit should transition to result screen after sync completion');
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

  if (name === 'case_timeout') {
    assertDebugHintIncludes(finalMessage, {
      endpoint: 'api/v1/get_questions.php?page=1&per_page=10',
      status: 408,
      bodyHint: false
    });
  }
}

const scenario = process.argv[2];
if (!scenario || !['case_a', 'case_b', 'case_c', 'case_timeout', 'case_unsynced_submit'].includes(scenario)) {
  throw new Error('Usage: node tests/frontend_runtime_flow_test.mjs <case_a|case_b|case_c|case_timeout|case_unsynced_submit>');
}

await runScenario(scenario);
console.log(`Runtime scenario ${scenario} passed`);
