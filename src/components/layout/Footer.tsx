import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="text-white mt-auto" style={{ backgroundColor: '#0f1214' }}>
      <div className="py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-3 col-md-6">
              <div className="d-flex align-items-center gap-2 mb-3">
                <img
                  alt="pie360"
                  height="30"
                  src="/assets/pie360-logo.png"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="fw-bold fs-4" style={{ color: '#cc533a' }}>pie</span><span className="fw-bold fs-4" style={{ color: '#73777f' }}>360</span>
              </div>
              <p className="small text-muted mb-2">Platform for Intelligent Education</p>
              <address className="small text-muted mb-0" style={{ fontStyle: 'normal' }}>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-geo-alt fs-6" /> Menlo Park, CA 94025, USA
                </div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-telephone fs-6" /> <a href="tel:+1-XXX-XXX-XXXX" className="text-muted text-decoration-none">***-***-****</a>
                </div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-envelope fs-6" /> <a href="mailto:support@lavanyatechnologies.com" className="text-muted text-decoration-none">support@lavanyatechnologies.com</a>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-globe fs-6" /> <a href="https://lavanyatechnologies.com" target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none">lavanyatechnologies.com</a>
                </div>
              </address>
            </div>

            <div className="col-lg-3 col-md-6">
              <h6 className="fw-bold mb-3">Quick Links</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-2"><Link to="/home" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Home</Link></li>
                <li className="mb-2"><Link to="/about" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> About us</Link></li>
                <li className="mb-2"><Link to="/contact" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Contact</Link></li>
                <li className="mb-2"><Link to="/products" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Products</Link></li>
                <li className="mb-2"><Link to="/privacy" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Privacy policy</Link></li>
                <li><Link to="/terms" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Terms & conditions</Link></li>
              </ul>
            </div>

            <div className="col-lg-3 col-md-6">
              <h6 className="fw-bold mb-3">Resources</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-2"><Link to="/documentation" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Documentation</Link></li>
                <li className="mb-2"><Link to="/api-docs" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> API Reference</Link></li>
                <li className="mb-2"><Link to="/blog" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Blog</Link></li>
                <li className="mb-2"><Link to="/help" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Help Center</Link></li>
                <li className="mb-2"><Link to="/community" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> Community</Link></li>
                <li><Link to="/status" className="text-muted text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-chevron-right fs-6" /> System Status</Link></li>
              </ul>
            </div>

            <div className="col-lg-3 col-md-6">
              <h6 className="fw-bold mb-3">Connect</h6>
              <div className="d-flex gap-3 mb-3">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none fs-5" aria-label="Twitter"><i className="bi bi-twitter-x" /></a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none fs-5" aria-label="LinkedIn"><i className="bi bi-linkedin" /></a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none fs-5" aria-label="GitHub"><i className="bi bi-github" /></a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none fs-5" aria-label="YouTube"><i className="bi bi-youtube" /></a>
              </div>
              <form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); }}>
                <input type="email" className="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Enter your email" aria-label="Email" style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary btn-sm">Subscribe</button>
              </form>
              <div className="mt-2">
                <div id="footer-turnstile" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6 mb-3 mb-md-0">
              <h6 className="fw-bold mb-2">Stay Updated</h6>
              <p className="small text-muted mb-0">Subscribe to our newsletter for the latest updates and features.</p>
            </div>
            <div className="col-md-6">
              <form className="d-flex gap-2 justify-content-md-end" onSubmit={(e) => { e.preventDefault(); }}>
                <input type="email" className="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Enter your email" aria-label="Email" style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary btn-sm">Subscribe</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="py-3">
        <div className="container">
          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2">
            <p className="small mb-0 text-white">&copy; {currentYear} pie360. All rights reserved.</p>
            <div className="d-flex gap-3">
              <Link to="/privacy" className="footer-bottom-link small text-muted text-decoration-none">Privacy</Link>
              <Link to="/terms" className="footer-bottom-link small text-muted text-decoration-none">Terms</Link>
              <Link to="/support" className="footer-bottom-link small text-muted text-decoration-none">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}