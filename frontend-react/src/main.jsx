import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const api = (url, options) => fetch(`/api${url}`, options).then(async response => {
  const body = await response.text();
  let result;
  let invalidJson = false;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    invalidJson = true;
    if (response.ok) throw Error('Server returned an invalid JSON response');
  }
  if (!response.ok) {
    throw Error(
      result?.error
      || (!invalidJson && body)
      || `Request failed (HTTP ${response.status})`
    );
  }
  return result;
});

export function App() {
  const [tab, setTab] = useState('Statement');
  const [transactions, setTransactions] = useState([]);
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState('FRAUD');
  const [message, setMessage] = useState('');

  const load = () => Promise.all([
    api('/transactions'),
    api('/disputes'),
    api('/tasklist')
  ]).then(([transactionRows, disputeCases, workflowTasks]) => {
    setTransactions(transactionRows);
    setCases(disputeCases);
    setTasks(workflowTasks);
  }).catch(error => setMessage(error.message));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async () => {
    const items = Object.keys(selected)
      .filter(id => selected[id])
      .map(transactionId => ({ transactionId, reason }));
    try {
      const disputeCase = await api('/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'customer-001', items })
      });
      setMessage(`Claim ${disputeCase.id.slice(0, 8)} submitted. Workflow ${
        disputeCase.workflowInstanceId || 'is disabled until Camunda is connected'
      }`);
      setSelected({});
      setTab('Tracking');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const respondToTask = async (task, accepted) => {
    try {
      await api(`/disputes/${task.caseId}/transactions/${task.id}/merchant-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted })
      });
      setMessage(`Merchant response recorded for ${task.merchant}.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const tabs = ['Statement', 'Tracking', 'Tasklist', 'Fraud desk'];
  const allItems = cases.flatMap(disputeCase => disputeCase.items);
  const activeCases = cases.filter(disputeCase => disputeCase.status !== 'COMPLETED').length;
  const highValueItems = allItems.filter(item => Number(item.amount) >= 4000).length;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <span className="brandmark">C</span>
        <div className="brand-copy"><small>CAPITAL ONE · CASE OPERATIONS</small><h1>Chargeback Center</h1></div>
      </div>
      <nav aria-label="Main navigation">
        {tabs.map(name => <button
          className={tab === name ? 'active' : ''}
          aria-current={tab === name ? 'page' : undefined}
          onClick={() => setTab(name)}
          key={name}
        >{name}</button>)}
      </nav>
    </header>

    {message && <p className="notice" role="status">{message}</p>}

    {tab === 'Statement' && <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">DISPUTES, WITH CLARITY</span>
          <p>Account ending in <b>4821</b></p>
          <h2>Clarity for every <span>charge.</span></h2>
          <p className="subcopy">Select the transactions you don’t recognize and submit one secure dispute case. We’ll track every line, every decision, and every refund.</p>
          <div className="trust"><span>One claim · multiple transactions</span><span>Live case visibility</span></div>
        </div>
        <button className="primary" disabled={!selectedCount} onClick={submit}>
          {selectedCount ? `Submit ${selectedCount} selected` : 'Select transactions'}
        </button>
      </section>

      <section className="overview-grid" aria-label="Dispute overview">
        <article className="overview-card">
          <span className="overview-label">Active cases</span>
          <strong className="overview-value">{activeCases}<small>in review</small></strong>
        </article>
        <article className="overview-card">
          <span className="overview-label">Merchant inbox</span>
          <strong className="overview-value">{tasks.length}<small>awaiting reply</small></strong>
        </article>
        <article className="overview-card">
          <span className="overview-label">High-value flags</span>
          <strong className="overview-value">{highValueItems}<small>fraud review</small></strong>
        </article>
        <article className="overview-card">
          <span className="overview-label">Claim items</span>
          <strong className="overview-value">{allItems.length}<small>tracked lines</small></strong>
        </article>
      </section>

      <section className="section-head">
        <div><span className="eyebrow">STATEMENT · SELECT MULTIPLE</span><h2>Recent transactions</h2></div>
        <label className="reason">Dispute reason
          <select value={reason} onChange={event => setReason(event.target.value)}>
            <option value="FRAUD">Fraud</option>
            <option value="MERCHANDISE_NOT_RECEIVED">Merchandise not received</option>
            <option value="DUPLICATE">Duplicate charge</option>
          </select>
        </label>
      </section>
      <section className="table-card">
        <div className="table-note">
          <span>Choose transaction lines to combine into one claim.</span>
          <span>{selectedCount} SELECTED · {transactions.length} STATEMENT LINES</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th></th><th>Transaction</th><th>Date</th><th>Amount</th><th>Card status</th></tr></thead>
            <tbody>{transactions.map(transaction => <tr key={transaction.id}>
              <td><input
                aria-label={`Select ${transaction.merchant}`}
                type="checkbox"
                disabled={transaction.disputed}
                checked={!!selected[transaction.id]}
                onChange={event => setSelected({
                  ...selected,
                  [transaction.id]: event.target.checked
                })}
              /></td>
              <td><strong>{transaction.merchant}</strong>
                <small>{transaction.id}{transaction.disputed ? ' · already disputed' : ''}</small>
              </td>
              <td>{transaction.date}</td>
              <td className="amount">₹{Number(transaction.amount).toLocaleString('en-IN')}</td>
              <td><span className="pill">{transaction.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}

    {tab === 'Tracking' && <Tracking cases={cases} />}
    {tab === 'Tasklist' && <Tasklist tasks={tasks} onRespond={respondToTask} />}
    {tab === 'Fraud desk' && <Fraud cases={cases} />}
    <footer><span>SIMULATED DATA · PROTECTED DEMO ENVIRONMENT</span><span>MULTI-TRANSACTION CHARGEBACK AUTOMATION</span></footer>
  </main>;
}

function Tracking({ cases }) {
  return <section className="content-panel">
    <div className="content-heading">
      <div><span className="eyebrow">CASE OPERATIONS</span><h2>Dispute tracking</h2></div>
      <p>Refreshes automatically while the case is being processed.</p>
    </div>
    {!cases.length
      ? <div className="empty">No dispute claims yet. Select transactions from your statement.</div>
      : cases.map(disputeCase => <article className="case" key={disputeCase.id}>
        <div><strong>Claim {disputeCase.id.slice(0, 8)}</strong>
          <small>{new Date(disputeCase.createdAt).toLocaleString()}</small>
        </div>
        <span className="pill">{disputeCase.status}</span>
        <ul>{disputeCase.items.map(item => <li key={item.id}>
          <b>{item.merchant}</b> — ₹{item.amount}
          <span className={`status ${item.decision}`}>{item.decision}</span>
          {' · refund: '}{item.refundStatus}
          {' · merchant: '}{item.merchantResponse || 'AWAITING'}
          {item.fraudAlertStatus !== 'NOT_REQUIRED'
            ? ` · fraud alert: ${item.fraudAlertStatus}`
            : ''}
        </li>)}</ul>
      </article>)}
  </section>;
}

function Tasklist({ tasks, onRespond }) {
  return <section className="content-panel">
    <div className="content-heading">
      <div><span className="eyebrow">HUMAN-IN-THE-LOOP</span><h2>Merchant response inbox</h2></div>
      <p>Responses correlate to a transaction while its timer window is open.</p>
    </div>
    {!tasks.length
      ? <div className="empty">No merchant responses are waiting. Start a workflow with Camunda enabled.</div>
      : tasks.map(task => <article className="case" key={task.id}>
        <div><strong>{task.merchant}</strong>
          <small>Transaction {task.transactionId} · case {task.caseId.slice(0, 8)}</small>
        </div>
        <span className="pill">AWAITING RESPONSE</span>
        <p>Disputed amount: ₹{Number(task.amount).toLocaleString('en-IN')}</p>
        <div className="task-actions">
          <button onClick={() => onRespond(task, true)}>Accept dispute</button>
          <button onClick={() => onRespond(task, false)}>Contest dispute</button>
        </div>
      </article>)}
  </section>;
}

function Fraud({ cases }) {
  const alerts = cases.flatMap(disputeCase => disputeCase.items)
    .filter(item => Number(item.amount) >= 4000);
  return <section className="content-panel">
    <div className="content-heading">
      <div><span className="eyebrow">RISK SIGNALS</span><h2>High-value fraud desk</h2></div>
    </div>
    <p>Items at or above ₹4,000 are routed through the REST connector to the fraud-desk API and optional Slack webhook.</p>
    {alerts.length
      ? <div className="fraud-table-wrap"><table><tbody>{alerts.map(item => <tr key={item.id}>
          <td>{item.merchant}</td>
          <td>₹{item.amount}</td>
          <td><span className="pill">{item.fraudAlertStatus}</span></td>
        </tr>)}</tbody></table></div>
      : <div className="empty">No high-value alerts yet.</div>}
  </section>;
}

export const root = createRoot(document.getElementById('root'));
root.render(<App />);
