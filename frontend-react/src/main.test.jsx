// Runtime validation coverage for the chargeback dashboard API flows.
// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transactions = [
  {
    id: 'txn-amazon',
    merchant: 'Amazon India',
    amount: 2000,
    date: '2026-11-08',
    status: 'POSTED',
    disputed: false
  },
  {
    id: 'txn-flipkart',
    merchant: 'Flipkart',
    amount: 5000,
    date: '2026-11-08',
    status: 'POSTED',
    disputed: false
  }
];

const merchantTask = {
  id: 'item-merchant',
  caseId: 'case-merchant',
  transactionId: 'txn-amazon',
  merchant: 'Amazon India',
  amount: 2000,
  status: 'PENDING_MERCHANT'
};

let root;
let cases;
let tasks;
let requestError;
let proxyFailure;

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  cases = [];
  tasks = [];
  requestError = false;
  proxyFailure = false;
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/transactions') {
      if (proxyFailure) {
        return { ok: false, status: 502, text: async () => '' };
      }
      return jsonResponse(transactions);
    }
    if (url === '/api/disputes' && options.method === 'POST') {
      if (requestError) {
        return jsonResponse({ error: 'Request rejected by API' }, 400);
      }
      const request = JSON.parse(options.body);
      cases = [{
        id: '12345678-case',
        createdAt: '2026-11-10T00:00:00Z',
        status: 'SUBMITTED',
        items: request.items.map((item, index) => ({
          id: `item-${index}`,
          transactionId: item.transactionId,
          merchant: transactions.find(row => row.id === item.transactionId).merchant,
          amount: transactions.find(row => row.id === item.transactionId).amount,
          reason: item.reason,
          decision: 'PENDING',
          refundStatus: 'NOT_STARTED',
          fraudAlertStatus: 'NOT_REQUIRED'
        }))
      }];
      return jsonResponse(cases[0], 201);
    }
    if (url === '/api/disputes') {
      return jsonResponse(cases);
    }
    if (url === '/api/tasklist') {
      return jsonResponse(tasks);
    }
    if (url.endsWith('/merchant-response')) {
      tasks = [];
      return jsonResponse({ status: 'correlated' }, 202);
    }
    return jsonResponse({ error: `Unexpected request: ${url}` }, 404);
  }));
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
    root = undefined;
  }
  vi.unstubAllGlobals();
  vi.resetModules();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderDashboard() {
  await act(async () => {
    ({ root } = await import('./main.jsx'));
  });
}

describe('chargeback dashboard', () => {
  it('loads transactions and submits multiple selected lines as one claim', async () => {
    await renderDashboard();

    expect(document.body.textContent).toContain('Amazon India');
    expect(document.body.textContent).toContain('Flipkart');

    await act(async () => {
      document.querySelector('[aria-label="Select Amazon India"]').click();
      document.querySelector('[aria-label="Select Flipkart"]').click();
    });

    const reason = document.querySelector('select');
    await act(async () => {
      reason.value = 'DUPLICATE';
      reason.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      document.querySelector('button.primary').click();
    });

    const createCall = fetch.mock.calls.find(
      ([url, options]) => url === '/api/disputes' && options?.method === 'POST'
    );
    expect(JSON.parse(createCall[1].body)).toEqual({
      customerId: 'customer-001',
      items: [
        { transactionId: 'txn-amazon', reason: 'DUPLICATE' },
        { transactionId: 'txn-flipkart', reason: 'DUPLICATE' }
      ]
    });
    expect(document.body.textContent).toContain('Claim 12345678 submitted.');
    expect(document.body.textContent).toContain('Dispute tracking');
    expect(document.body.textContent).toContain('Amazon India');
    expect(document.body.textContent).toContain('Flipkart');
  });

  it('submits a merchant response and displays the successful API result', async () => {
    tasks = [merchantTask];
    await renderDashboard();

    await act(async () => {
      [...document.querySelectorAll('nav button')]
        .find(button => button.textContent === 'Tasklist')
        .click();
    });
    expect(document.body.textContent).toContain('Amazon India');

    await act(async () => {
      [...document.querySelectorAll('button')]
        .find(button => button.textContent === 'Accept dispute')
        .click();
    });

    const responseCall = fetch.mock.calls.find(([url]) =>
      url.endsWith('/merchant-response')
    );
    expect(responseCall[0]).toBe(
      '/api/disputes/case-merchant/transactions/item-merchant/merchant-response'
    );
    expect(JSON.parse(responseCall[1].body)).toEqual({ accepted: true });
    expect(document.body.textContent).toContain(
      'Merchant response recorded for Amazon India.'
    );
  });

  it('shows API validation errors instead of a success message', async () => {
    requestError = true;
    await renderDashboard();

    await act(async () => {
      document.querySelector('[aria-label="Select Amazon India"]').click();
    });
    await act(async () => {
      document.querySelector('button.primary').click();
    });

    expect(document.body.textContent).toContain('Request rejected by API');
    expect(document.body.textContent).not.toContain('Claim 12345678 submitted.');
  });

  it('shows the HTTP status when the proxy returns an empty error response', async () => {
    proxyFailure = true;
    await renderDashboard();

    expect(document.body.textContent).toContain('Request failed (HTTP 502)');
  });
});
