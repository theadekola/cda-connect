import {FiCheckCircle,FiUsers} from 'react-icons/fi';
import logo from '../../assets/branding/cda-connect-logo.png';
import communityBackground from '../../assets/branding/welcome-community.png';

export default function Welcome(){
  return <main className="welcome-page">
    <section className="welcome-hero" style={{backgroundImage:`url("${communityBackground}")`}} aria-label="A connected residential community">
      <div className="welcome-hero-shade"/>
      <div className="welcome-hero-brand"><img src={logo} alt=""/><strong>CDA Connect</strong></div>
      <div className="welcome-hero-copy">
        <div className="welcome-eyebrow"><FiUsers/><span>BUILT FOR EVERY COMMUNITY</span></div>
        <h1>Everything your<br/>community needs, all in<br/>one place.</h1>
        <p>Connect neighbours, share updates, manage events and make<br className="welcome-wide-break"/> decisions together through one trusted community workspace.</p>
        <div className="welcome-benefits">
          {['Stay informed','Work together','Build stronger communities'].map(label=><span key={label}><FiCheckCircle/>{label}</span>)}
        </div>
      </div>
    </section>
    <section className="welcome-panel">
      <div className="welcome-panel-content">
        <h2>Welcome to your<br/>community</h2>
        <p>Join your neighbours and help build a safer, more<br className="welcome-wide-break"/> connected and thriving community.</p>
        <a className="welcome-primary" href="/onboarding">Create an account</a>
        <a className="welcome-signin" href="/login">Already have an account? <strong>Sign in</strong></a>
      </div>
    </section>
  </main>
}
