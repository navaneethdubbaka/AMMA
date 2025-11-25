import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Contact from './components/Contact'
import Login from './components/Login'
import Profile from './components/Profile'
import PatientProfile from './pages/PatientProfile'
import DoctorProfile from './pages/DoctorProfile'
import PatientFilesPage from './pages/PatientFilesPage'
import EpicCallbackPage from './pages/EpicCallbackPage'
const ammaLogo = '/images/Black Elephant Flat Illustrative Company Logo.png'
import './App.css'



function HomePage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: ''
  })

  const [openFaq, setOpenFaq] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Demo requested:', formData)
    alert('Thank you! We\'ll be in touch shortly to schedule your demo.')
    setFormData({ name: '', email: '', organization: '' })
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const scrollToDemoForm = () => {
    setFormOpen(true)
    setTimeout(() => {
      document.querySelector('.demo-toggle-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  return (
    <div className="app">



      {/* Navigation */}
      <nav className="navbar">
        <div className="logo">
          <img src={ammaLogo} alt="Amma" className="logo-image" />
          <span className="logo-text">Amma</span>
        </div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => navigate('/contact')}>Contact</button>
          <button className="nav-cta" onClick={() => navigate('/login')}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="section-label">HERO</div>
        <div className="hero-content">
          <div className="announcement-badge">
            <span className="pulse-dot"></span>
            Backed by Sam Altman's The Residency
          </div>
          
          <h1 className="hero-title">
            AI Video Generation
            <br />
            <span className="gradient-text">for Modern Healthcare</span>
          </h1>
          
          <p className="hero-description">
          Automatically turn each diagnosis into a personalized animated video for every patient.
          </p>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-number">50%</div>
              <div className="stat-label">shorter appointments</div>
            </div>
            <div className="stat">
              <div className="stat-number">100+</div>
              <div className="stat-label">clinicians inside</div>
            </div>
            <div className="stat">
              <div className="stat-number">5000+</div>
              <div className="stat-label">videos generated</div>
            </div>
      </div>

          <button 
            className="demo-toggle-btn"
            onClick={() => setFormOpen(!formOpen)}
          >
            {formOpen ? 'Close Form ✕' : 'Book a Demo →'}
          </button>

          {formOpen && (
            <form onSubmit={handleSubmit} className="demo-form">
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                className="form-input"
              />
              <input
                type="email"
                placeholder="Work Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="form-input"
              />
              <input
                type="text"
                placeholder="Organization"
                value={formData.organization}
                onChange={(e) => setFormData({...formData, organization: e.target.value})}
                required
                className="form-input"
              />
              <button type="submit" className="submit-btn">
                Submit Demo Request →
        </button>
            </form>
          )}
        </div>
        <div className="gradient-blur"></div>
      </section>

      {/* Problem Statement */}
      <section className="problem-section">
        <div className="section-label">PROBLEM</div>
        <div className="problem-content">
          <h2 className="problem-title">
            Patient confusion is <span className="gradient-text">costing you time</span>
          </h2>
          <p className="problem-description">
            Repeated explanations. Endless follow-up calls. Poor treatment adherence. 
            Your patients leave confused, and your staff spends hours answering the same questions.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-heading">
          How <span className="gradient-text">Amma works</span>
        </h2>
        <p className="section-subheading">
          From diagnosis to recovery, Amma transforms complex medical information into 
          personalized animated videos that patients actually understand and follow.
        </p>

        <div className="feature-showcase">
          <div className="feature-large">
            <div className="feature-visual">
              <video 
                autoPlay 
                loop 
                muted 
                playsInline
                className="feature-video"
              >
                <source src="/images/20251121_0810_01kakjqdsse5jb6f3mdz9p3j0t.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-text">
              <h3>Instant Personalized Videos</h3>
              <p>
                Upload clinical notes or select a diagnosis, and Amma instantly generates 
                hyper-personalized animated videos. Each video explains the condition and 
                treatment in plain language tailored to your patient's specific situation.
              </p>
            </div>
          </div>

          <div className="feature-large reverse">
            <div className="feature-visual">
              <img 
                src="/images/Screenshot 2025-11-21 at 5.50.24 PM.png"
                alt="Daily Follow-Up Animations"
                className="feature-image"
              />
            </div>
            <div className="feature-text">
              <h3>Daily Follow-Up Animations</h3>
              <p>
                After the visit, patients receive daily bite-sized animations through the paired 
                mobile app. Each animation guides medications, exercises, and follow-ups step-by-step, 
                ensuring patients actually stick to their recovery plan.
              </p>
            </div>
          </div>

          <div className="feature-large">
            <div className="feature-visual">
              <img 
                src="/images/Screenshot 2025-11-21 at 5.50.39 PM.png"
                alt="Real-Time AI Q&A"
                className="feature-image"
              />
            </div>
            <div className="feature-text">
              <h3>Real-Time AI Q&A</h3>
              <p>
                Patients can ask questions anytime—Amma's AI answers instantly in chat or 
                generates a new video on the spot. Clinicians stay in the loop through the shared 
                app, so they're always aware without fielding every call.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="testimonial-section">
        <div className="section-label">TESTIMONIAL</div>
        <div className="testimonial-content">
          <h2 className="testimonial-quote">
            "We've cut follow-up calls in half. Patients finally understand their treatment, 
            and my staff has time to focus on actual care instead of answering the same questions."
          </h2>
          <div className="testimonial-author">
            <div className="author-name">Dr. Vani Velkuru</div>
            <div className="author-title">Head Rheumotologist, Washington Hospital</div>
          </div>
        </div>
        <div className="trusted-by">
          <p>Trusted by clinics and practices including:</p>
          <div className="logo-strip">
            <div className="company-logo">Valley Ortho</div>
            <div className="company-logo">Bay Area PT</div>
            <div className="company-logo">Summit Cardiology</div>
            <div className="company-logo">Westside Family Med</div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="section-label">BENEFITS</div>
        <h2 className="section-heading">What we actually change</h2>
        <p className="section-subheading">
          Cut confusion, reduce callbacks, and boost adherence—without adding 
          to your staff's workload.
        </p>

        <div className="benefits-grid">
          <div className="benefit-card">
            <h3>Dramatically Fewer Follow-Up Calls</h3>
            <p>
              When patients actually understand their treatment through personalized videos, 
              they stop calling with the same questions. Your staff reclaims hours every week.
            </p>
          </div>

          <div className="benefit-card">
            <h3>Better Treatment Adherence</h3>
            <p>
              Daily bite-sized animations keep patients on track with medications, exercises, 
              and follow-ups. No more guessing if they're following the plan.
            </p>
          </div>

          <div className="benefit-card">
            <h3>Save Time Per Patient</h3>
            <p>
              Stop repeating the same explanations every visit. Amma handles patient 
              education automatically, freeing you to focus on diagnosis and treatment.
            </p>
          </div>

          <div className="benefit-card">
            <h3>HIPAA-Compliant & Secure</h3>
            <p>
              Everything runs in a fully secure, HIPAA-compliant environment. You get peace 
              of mind while delivering better patient care.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-label">FAQ</div>
        <h2 className="section-heading">Frequently asked questions</h2>
        <p className="section-subheading">
          Here are some of our most frequently asked questions.
        </p>

        <div className="faq-container">
          <div className={`faq-item ${openFaq === 0 ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => toggleFaq(0)}>
              <span>What types of conditions and specialties does Amma support?</span>
              <span className="faq-icon">{openFaq === 0 ? '−' : '+'}</span>
            </button>
            {openFaq === 0 && (
              <div className="faq-answer">
                Amma works across specialties—orthopedics, cardiology, physical therapy, 
                primary care, and more. Whether it's post-op instructions, chronic disease 
                management, or medication adherence, our AI generates personalized videos for 
                any diagnosis or treatment plan.
              </div>
            )}
          </div>

          <div className={`faq-item ${openFaq === 1 ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => toggleFaq(1)}>
              <span>How does pricing work?</span>
              <span className="faq-icon">{openFaq === 1 ? '−' : '+'}</span>
            </button>
            {openFaq === 1 && (
              <div className="faq-answer">
                We offer flexible per-clinician or per-patient pricing based on your practice size. 
                Most clinics start with a pilot and scale up as they see results. Book a demo 
                to discuss what works best for your workflow.
              </div>
            )}
          </div>

          <div className={`faq-item ${openFaq === 2 ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => toggleFaq(2)}>
              <span>Is Amma HIPAA compliant?</span>
              <span className="faq-icon">{openFaq === 2 ? '−' : '+'}</span>
            </button>
            {openFaq === 2 && (
              <div className="faq-answer">
                Yes, absolutely. Amma runs in a fully HIPAA-compliant environment with 
                enterprise-grade encryption, secure data storage, and comprehensive Business 
                Associate Agreements (BAAs). Patient privacy and security are our top priority.
              </div>
            )}
          </div>

          <div className={`faq-item ${openFaq === 3 ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => toggleFaq(3)}>
              <span>How long does setup take?</span>
              <span className="faq-icon">{openFaq === 3 ? '−' : '+'}</span>
            </button>
            {openFaq === 3 && (
              <div className="faq-answer">
                Most clinics are up and running within a few days. We provide simple onboarding, 
                staff training, and support to get you started. No complex EHR integration required—
                just upload notes or select a diagnosis and you're ready to go.
              </div>
            )}
          </div>

          <div className={`faq-item ${openFaq === 4 ? 'open' : ''}`}>
            <button className="faq-question" onClick={() => toggleFaq(4)}>
              <span>Do patients need to download an app?</span>
              <span className="faq-icon">{openFaq === 4 ? '−' : '+'}</span>
            </button>
            {openFaq === 4 && (
              <div className="faq-answer">
                Yes, patients receive their personalized videos via the Amma mobile app, 
                which also delivers daily follow-up animations and allows them to ask questions 
                anytime. The app is available on iOS and Android and takes seconds to set up.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="section-label">GET STARTED</div>
        <div className="cta-content">
          <h2 className="cta-title">Stop repeating yourself. Start healing better.</h2>
          <p className="cta-description">
            Join 100+ clinicians using Amma to save time, reduce callbacks, 
            and help patients actually follow through on their care.
          </p>
          <button className="cta-button" onClick={scrollToDemoForm}>Book Your Demo →</button>
      </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={ammaLogo} alt="Amma" style={{ height: '35px', width: 'auto' }} />
              <span className="logo-text">Amma</span>
            </div>
            <p className="footer-tagline">
              AI copilot for patient understanding and follow-through.
            </p>
          </div>
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <span>·</span>
            <a href="#terms">Terms of Service</a>
            <span>·</span>
            <a href="#contact">Contact</a>
          </div>
        </div>
        {/* <p className="footer-copyright">© 2024 Amma. All rights reserved.</p> */}
      </footer>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/patient" element={<PatientProfile />} />
      <Route path="/doctor" element={<DoctorProfile />} />
      <Route path="/patient-files" element={<PatientFilesPage />} />
      <Route path="/epic-callback" element={<EpicCallbackPage />} />
    </Routes>
  )
}

export default App
