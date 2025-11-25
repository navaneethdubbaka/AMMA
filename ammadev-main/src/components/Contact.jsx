import { useNavigate } from 'react-router-dom'
import './Contact.css'

function Contact() {
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Submission sent')
    e.target.reset()
  }

  return (
    <div className="contact-page">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Home
      </button>
      
      <div className="contact-container">
        <h1 className="contact-title">Get in Touch</h1>
        <p className="contact-subtitle">We'd love to hear from you</p>

        <div className="contact-content">
          <div className="contact-info">
            <h2>Contact Information</h2>
            <div className="info-item">
              <div className="info-label">Phone</div>
              <a href="tel:5103626544" className="info-value">(510) 362-6544</a>
            </div>
            <div className="info-item">
              <div className="info-label">Email</div>
              <a href="mailto:ammacare@gmail.com" className="info-value">ammacare@gmail.com</a>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <h2>Send us a message</h2>
            <input type="text" placeholder="Name" className="contact-input" required />
            <input type="email" placeholder="Email" className="contact-input" required />
            <input type="text" placeholder="Subject" className="contact-input" required />
            <textarea placeholder="Message" rows="5" className="contact-textarea" required></textarea>
            <button type="submit" className="contact-submit">
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Contact

