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
  const [loadError, setLoadError] = useState('');

  const load = () => Promise.all([
    api('/transactions'),
    api('/disputes'),
    api('/tasklist')
  ]).then(([transactionRows, disputeCases, workflowTasks]) => {
    setTransactions(transactionRows);
    setCases(disputeCases);
    setTasks(workflowTasks);
    setLoadError('');
  }).catch(error => setLoadError(error.message));

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
  const tabs = ['Statement', 'Tracking', 'Tasklist', 'Fraud desk', 'About'];
  const allItems = cases.flatMap(disputeCase => disputeCase.items);
  const activeCases = cases.filter(disputeCase => disputeCase.status !== 'COMPLETED').length;
  const highValueItems = allItems.filter(item => Number(item.amount) >= 4000).length;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <span className="brandmark" aria-hidden="true"><i></i><i></i></span>
        <div className="brand-copy"><small>DISPUTE OPERATIONS</small><h1>Clearcase</h1></div>
      </div>
      <nav aria-label="Main navigation">
        {tabs.map(name => <button
          className={tab === name ? 'active' : ''}
          aria-current={tab === name ? 'page' : undefined}
          onClick={() => setTab(name)}
          key={name}
        >{name}</button>)}
      </nav>
      <div className="topbar-meta"><span className="status-dot"></span><span>DEMO ENVIRONMENT</span></div>
    </header>

    {(message || loadError) && <p className="notice" role="status">{message || loadError}</p>}

    {tab === 'Statement' && <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">YOUR STATEMENT, WITH MORE CLARITY</span>
          <p className="account-label">Everyday account <b>•• 4821</b></p>
          <h2>Make room for <em>a fair review.</em></h2>
          <p className="subcopy">Choose the charges you want us to look into. Bring them together in one case, then follow each one as it moves forward.</p>
          <div className="hero-actions">
            <a className="text-link" href="#statement">Review recent charges <span aria-hidden="true">↓</span></a>
            <span className="demo-caption">Sample transactions · no real card data</span>
          </div>
        </div>
        <div className="hero-art" aria-label="A visual summary of a multi-transaction dispute">
          <div className="art-orbit orbit-one"></div>
          <div className="art-orbit orbit-two"></div>
          <div className="art-stamp">ONE CASE<br /><b>MANY LINES</b></div>
          <article className="preview-card">
            <div className="preview-top"><span>DISPUTE PREVIEW</span><span className="preview-spark"></span></div>
            <div className="preview-amount">₹7,000</div>
            <div className="preview-caption">Across two example transactions</div>
            <div className="preview-divider"></div>
            <div className="preview-row"><span><i className="merchant-mark">A</i> Amazon India</span><b>₹2,000</b></div>
            <div className="preview-row"><span><i className="merchant-mark merchant-mark-alt">F</i> Flipkart</span><b>₹5,000</b></div>
          </article>
          <span className="art-note">One thoughtful step at a time</span>
        </div>
      </section>

      <div className="ticker" aria-label="One request, multiple transactions, clear decisions">
        <div className="ticker-track" aria-hidden="true">
          <span>ONE REQUEST</span><i>✳</i><span>MULTIPLE TRANSACTIONS</span><i>✳</i><span>VISIBLE DECISIONS</span><i>✳</i><span>ONE REQUEST</span><i>✳</i><span>MULTIPLE TRANSACTIONS</span><i>✳</i><span>VISIBLE DECISIONS</span><i>✳</i>
        </div>
      </div>

      <section className="overview-grid" aria-label="Dispute overview">
        <article className="overview-card">
          <span className="overview-label"><i className="metric-dot dot-blue"></i>Active cases</span>
          <strong className="overview-value">{activeCases}<small>in review</small></strong>
          <span className="card-index">01</span>
        </article>
        <article className="overview-card">
          <span className="overview-label"><i className="metric-dot dot-orange"></i>Merchant inbox</span>
          <strong className="overview-value">{tasks.length}<small>awaiting reply</small></strong>
          <span className="card-index">02</span>
        </article>
        <article className="overview-card">
          <span className="overview-label"><i className="metric-dot dot-green"></i>High-value flags</span>
          <strong className="overview-value">{highValueItems}<small>fraud review</small></strong>
          <span className="card-index">03</span>
        </article>
        <article className="overview-card">
          <span className="overview-label"><i className="metric-dot dot-lilac"></i>Claim items</span>
          <strong className="overview-value">{allItems.length}<small>tracked lines</small></strong>
          <span className="card-index">04</span>
        </article>
      </section>

      <section className="section-head" id="statement">
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
          <span>Select the charges you’d like us to review together.</span>
          <span>{selectedCount} SELECTED <i>·</i> {transactions.length} SAMPLE LINES</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th></th><th>Transaction</th><th>Date</th><th>Amount</th><th>Card status</th></tr></thead>
            <tbody>{transactions.map(transaction => <tr className={selected[transaction.id] ? 'is-selected' : ''} key={transaction.id}>
              <td data-label="Select"><input
                aria-label={`Select ${transaction.merchant}`}
                type="checkbox"
                disabled={transaction.disputed}
                checked={!!selected[transaction.id]}
                onChange={event => setSelected({
                  ...selected,
                  [transaction.id]: event.target.checked
                })}
              /></td>
              <td data-label="Transaction"><strong>{transaction.merchant}</strong>
                <small>{transaction.id}{transaction.disputed ? ' · already disputed' : ''}</small>
              </td>
              <td data-label="Date">{transaction.date}</td>
              <td data-label="Amount" className="amount">₹{Number(transaction.amount).toLocaleString('en-IN')}</td>
              <td data-label="Card status"><span className="pill">{transaction.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="process-strip" aria-label="What happens next">
        <div><span className="step-number">01</span><span><b>Choose</b><small>Pick one or more charges</small></span></div>
        <i aria-hidden="true"></i>
        <div><span className="step-number">02</span><span><b>Review</b><small>Each line is evaluated</small></span></div>
        <i aria-hidden="true"></i>
        <div><span className="step-number">03</span><span><b>Follow</b><small>See decisions and outcomes</small></span></div>
        <button className="primary" disabled={!selectedCount} onClick={submit}>
          {selectedCount ? `Review ${selectedCount} selected` : 'Select charges above'}
          <span aria-hidden="true">↗</span>
        </button>
      </section>
    </>}

    {tab === 'Tracking' && <Tracking cases={cases} />}
    {tab === 'Tasklist' && <Tasklist tasks={tasks} onRespond={respondToTask} />}
    {tab === 'Fraud desk' && <Fraud cases={cases} />}
    {tab === 'About' && <About />}
    <footer><span>BUILT FOR CLARITY · POWERED BY A CAMUNDA WORKFLOW DEMO</span><span>SIMULATED DATA ONLY · NEVER USE REAL CARD DETAILS</span></footer>
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

function About() {
  return <section className="about-page">
    <div className="about-intro">
      <span className="eyebrow">THE PEOPLE BEHIND THE PROJECT</span>
      <h2>Built with care.<br /><em>Designed for clarity.</em></h2>
      <p>Clearcase is a student-built workflow automation project exploring how a single, understandable process can help manage disputes involving multiple transactions.</p>
    </div>
    <div className="about-note">
      <span className="note-kicker">PROJECT 03 <i>·</i> BANKING &amp; FINANCIAL SERVICES</span>
      <p>Inspired by real-world chargeback operations, this prototype brings together a React portal, a Spring Boot API, a relational data layer, and Camunda 8 process orchestration.</p>
      <span className="note-foot">A learning project — not affiliated with or endorsed by Capital One.</span>
    </div>
    <div className="team-heading"><div><span className="eyebrow">MEET THE TEAM</span><h3>Two collaborators, one shared build.</h3></div><span className="team-count">02 MEMBERS</span></div>
    <div className="team-grid">
      <article className="team-card team-card-dito">
        <div className="team-avatar">DD</div>
        <span className="team-role">WORKFLOW &amp; PLATFORM</span>
        <h3>Dito Dileep</h3>
        <p>Contributes to BPMN architecture, Camunda integration, deployment, and implementation.</p>
        <span className="team-number">01 <i>—</i> PROJECT TEAM</span>
      </article>
      <article className="team-card team-card-adithya">
        <div className="team-avatar">AR</div>
        <span className="team-role">APPLICATION &amp; EXPERIENCE</span>
        <h3>Adithya R Nath</h3>
        <p>Contributes to Spring Boot APIs, the React interface, REST integration, and testing.</p>
        <span className="team-number">02 <i>—</i> PROJECT TEAM</span>
      </article>
    </div>
    <div className="about-principles">
      <span className="eyebrow">WHAT GUIDES THE BUILD</span>
      <div><b>Transparent by default</b><p>Show what is known, what is pending, and what needs a real workflow engine.</p></div>
      <div><b>Useful beyond a demo</b><p>Keep boundaries clear between sample data, local simulation, and production infrastructure.</p></div>
      <div><b>Thoughtful on every screen</b><p>Make the essential actions legible on a desktop, tablet, or phone.</p></div>
    </div>
  </section>;
}

export const root = import.meta.hot?.data.root
  || createRoot(document.getElementById('root'));
if (import.meta.hot) {
  import.meta.hot.dispose(data => {
    data.root = root;
  });
}
root.render(<App />);
