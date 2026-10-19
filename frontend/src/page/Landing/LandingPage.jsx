import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import './landing.css';

const FEATURES = [
  { icon: '⚡', title: 'Zero Latency', desc: 'Sub-millisecond order execution powered by co-located servers. Your orders reach the exchange before you blink.' },
  { icon: '📊', title: 'Advanced Charting', desc: 'Professional-grade charts with 100+ indicators, drawing tools, and multi-timeframe analysis built right in.' },
  { icon: '🛡️', title: 'Bank-Grade Security', desc: '256-bit encryption, 2FA authentication, and segregated client accounts. Your funds are always protected.' },
  { icon: '💎', title: 'Premium Margins', desc: 'Up to 100x intraday leverage on select instruments. Maximize your trading capital with aggressive margin facilities.' },
  { icon: '📱', title: 'Trade Anywhere', desc: 'Seamless experience across web, mobile, and tablet. Install as a PWA for native-app speed on any device.' },
  { icon: '🤝', title: 'Dedicated Support', desc: 'Priority support with a personal relationship manager. We are available when markets are — and beyond.' },
];

import { ArrowLeft } from 'lucide-react';

export default function LandingPage({ isAboutMode = false, onClose }) {
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();
  const isLight = !isDark;
  const [price, setPrice] = useState(22450.85);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const obsRef = useRef(null);

  // Auto-redirect if logged in
  useEffect(() => {
    if (isAboutMode) return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('loggedInUser');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const bid = localStorage.getItem('associatedBrokerStringId');
        if (user.role === 'admin') navigate('/admin/registrations', { replace: true });
        else if (user.role === 'broker') navigate(bid ? `/broker/${bid}/customerDetail` : '/customerDetail', { replace: true });
        else navigate('/watchlist', { replace: true });
      } catch { /* show page */ }
    }
  }, []);

  // Live price ticker
  useEffect(() => {
    const id = setInterval(() => setPrice(p => p + (Math.random() - 0.5) * 12), 1500);
    return () => clearInterval(id);
  }, []);

  // Scroll fade-in observer
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.15 });
    obsRef.current = obs;
    document.querySelectorAll('.lp-fade-up').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Card glow tracking
  useEffect(() => {
    const handler = (card) => (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    };
    const cards = document.querySelectorAll('.lp-fcard');
    const handlers = [];
    cards.forEach(c => { const h = handler(c); c.addEventListener('mousemove', h); handlers.push([c, h]); });
    return () => handlers.forEach(([c, h]) => c.removeEventListener('mousemove', h));
  }, []);

  const fmt = price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={`lp ${isLight ? 'light' : ''}`}>
      {/* Ambient orbs */}
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />

      {/* ── NAV ── */}
      <nav className={`lp-nav ${isMobileMenuOpen ? 'menu-open' : ''}`}>
        <a href="/" className="lp-nav-logo" onClick={e => e.preventDefault()}>
          <img src="/image.png" alt="DhanLaxmi" />
          <span>DHANLAXMI</span>
        </a>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#stats">Why Us</a>
          <a href="#cta">Get Started</a>
        </div>
        <div className="lp-nav-right">
          {isAboutMode ? (
            <button className="lp-btn-theme" onClick={onClose} title="Go Back">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <>
              <button className="lp-btn-theme" onClick={toggleTheme} title={isLight ? 'Dark Mode' : 'Light Mode'}>
            {isLight ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            )}
          </button>
          <div className="lp-desktop-btns">
            <button className="lp-btn lp-btn-ghost" onClick={() => navigate('/register')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
              Register as Partner
            </button>
            <button className="lp-btn lp-btn-primary" onClick={() => navigate('/login')}>
              Start Trading
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
          <button className="lp-mobile-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            )}
          </button>
          </>
        )}
        </div>
      </nav>

      {/* ── MOBILE MENU ── */}
      {!isAboutMode && (
        <div className={`lp-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="lp-mobile-menu-inner">
          <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
          <a href="#stats" onClick={() => setIsMobileMenuOpen(false)}>Why Us</a>
          <a href="#terms" onClick={() => setIsMobileMenuOpen(false)}>Terms</a>
          <div className="lp-mobile-menu-divider"></div>
          <button className="lp-btn lp-btn-ghost" onClick={() => { setIsMobileMenuOpen(false); navigate('/register'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Register as Partner
          </button>
          <button className="lp-btn lp-btn-primary" onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }} style={{ justifyContent: 'center' }}>
            Start Trading
          </button>
        </div>
      </div>
      )}

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div>
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              Markets Open • Live Trading
            </div>
            <h1>
              Trade Smarter.<br />
              <span className="lp-gradient-text">Invest with Confidence.</span>
            </h1>
            <p>
              Experience next-generation trading infrastructure built for speed, reliability, 
              DhanLaxmi Capital delivers institutional-grade execution for every trader. 
              Zero brokerage on delivery, intuitive charts, and blazing fast order routing.
            </p>
            {!isAboutMode && (
              <div className="lp-hero-btns">
                <button className="lp-btn lp-btn-primary" onClick={() => navigate('/login')}>
                  Open Free Account
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
                <button className="lp-btn lp-btn-ghost" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                  Explore Platform
                </button>
              </div>
            )}
          </div>

          {/* Widget */}
          <div className="lp-widget">
            <div className="lp-widget-head">
              <div>
                <div className="lp-widget-symbol">NIFTY 50</div>
                <div className="lp-widget-tag">LIVE</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="lp-widget-price">{fmt}</div>
                <div className="lp-widget-change">▲ +1.24%</div>
              </div>
            </div>
            <div className="lp-wave-box"><div className="lp-wave" /></div>
            {!isAboutMode && (
              <div className="lp-widget-btns">
                <button className="lp-buy" onClick={() => navigate('/login')}>BUY / LONG</button>
                <button className="lp-sell" onClick={() => navigate('/login')}>SELL / SHORT</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats lp-fade-up" id="stats">
        <div className="lp-stat">
          <div className="lp-stat-val">₹<span>0.01</span></div>
          <div className="lp-stat-label">Min Brokerage</div>
        </div>
        <div className="lp-stat">
          <div className="lp-stat-val"><span>60</span>x<span>-</span><span>500</span>x</div>
          <div className="lp-stat-label">Max Leverage</div>
        </div>
        <div className="lp-footer-bottom">
          <div className="lp-footer-copy">© 2026 DhanLaxmi Capital Pvt. Ltd.</div>
          {/* <div className="lp-footer-legal">
            SEBI Registration No: INZ000000000 | NSE Member Code: 00000
          </div> */}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <div className="lp-section-head lp-fade-up">
          <h2>Built for <span className="lp-gradient-text">Serious Traders</span></h2>
          <p>Everything you need to trade with confidence — from powerful analytics to rock-solid execution.</p>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div className="lp-fcard lp-fade-up" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="lp-fcard-icon"><span style={{ fontSize: '1.4rem' }}>{f.icon}</span></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TERMS & CONDITIONS ── */}
      <section className="lp-features" id="terms" style={{ background: 'var(--bg-2)', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lp-section-head lp-fade-up">
          <h2>Terms & <span className="lp-gradient-text">Conditions</span></h2>
          <p>Please read these terms carefully before trading with DhanLaxmi Trading App.</p>
        </div>

        <div className="lp-terms-container lp-fade-up" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 5%' }}>
          <div className="lp-term-box">
            <h3 className="lp-term-title"><span>1.</span> Brokerage Charges</h3>
            <ul className="lp-term-list">
              <li>Buy and Sell transactions will carry a 0.01% brokerage fee.</li>
              <li>Brokerage charges are automatically updated when trades are executed.</li>
            </ul>
          </div>

          <div className="lp-term-box">
            <h3 className="lp-term-title"><span>2.</span> Leverage Policy</h3>
            <ul className="lp-term-list">
              <li><strong>Intraday Trading:</strong>
                <ul>
                  <li>Futures & Equity: leverage between 60x to 500x.</li>
                  <li>Options: leverage between 10x to 200x.</li>
                </ul>
              </li>
              <li>Leverage provides flexibility and opportunities for trading.</li>
            </ul>
          </div>

          <div className="lp-term-box">
            <h3 className="lp-term-title"><span>3.</span> Trend Maintenance</h3>
            <ul className="lp-term-list">
              <li>A minimum weekly trend must be maintained.</li>
              <li>If not maintained, penalty charges will apply to encourage trading discipline.</li>
            </ul>
          </div>

          <div className="lp-term-box">
            <h3 className="lp-term-title"><span>4.</span> Margin Requirement</h3>
            <ul className="lp-term-list">
              <li>To hold trades, customers must pay the required margin.</li>
              <li>The margin system ensures stability and security in trading positions.</li>
            </ul>
          </div>

          <div className="lp-term-box">
            <h3 className="lp-term-title"><span>5.</span> Document Verification</h3>
            <ul className="lp-term-list">
              <li>Accounts will be activated only after document verification.</li>
              <li>Incomplete or incorrect documents may lead to rejection.</li>
              <li>Verification is designed for customer account safety.</li>
            </ul>
          </div>

          <div className="lp-term-box lp-term-safety">
            <h3 className="lp-term-title" style={{ color: 'var(--accent-light)' }}>🌟 Customer Care & Safety</h3>
            <ul className="lp-term-list">
              <li><strong>Withdrawal Policy:</strong> Withdrawals are allowed only on Saturdays. Requests on other days will not be processed.</li>
              <li><strong>Loss Settlement:</strong> Any losses incurred in trading must be settled by the customer.</li>
              <li><strong>Account Suspension:</strong> Accounts may be temporarily suspended in case of policy violations. This step is taken to protect customer funds and platform safety.</li>
              <li><strong>Customer Support:</strong> All rules and processes are designed to provide a safe, transparent, and smooth trading experience.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      {!isAboutMode && (
        <section className="lp-cta lp-fade-up" id="cta">
          <div className="lp-cta-text">
            <h2>Ready to Upgrade Your Trading?</h2>
            <p>Join thousands of traders who trust DhanLaxmi Capital for fast execution, low costs, and premium support.</p>
            <button className="lp-btn lp-btn-primary" onClick={() => navigate('/login')} style={{ position: 'relative' }}>
              Create Free Account
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
          <div className="lp-nav-logo">
          <img src="/landing-logo.png" alt="DhanLaxmi" />
          <span>DhanLaxmi</span>
        </div>
          <div className="lp-footer-links">
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
            <a href="#risk">Risk Disclosure</a>
            <a href="#fees">Fees</a>
          </div>
          <div className="lp-footer-copy">© 2026 DhanLaxmi Capital Pvt. Ltd.</div>
        </footer>
    </div>
  );
}
