'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  commitmentBands,
  compensationTypes,
  defaultProjectFilters,
  filterProjects,
  type ProjectFilters,
  type ProjectOpening,
  projectRoles,
  projects,
} from '../data/projects';
import { ThemeToggle } from './theme-toggle';

function LoginPanel({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // The panel moves initial focus and supports Escape so it remains usable by keyboard.
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="login-title"
        aria-modal="true"
        className="login-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close login"
          className="icon-button close-button"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>
        <span className="eyebrow">Member access</span>
        <h2 id="login-title">Log in to Branch-Out</h2>
        <p>
          GitHub sign-in will connect profiles to real work evidence. Account
          authentication will be activated with the backend onboarding feature.
        </p>
        <button className="github-button" disabled type="button">
          Continue with GitHub
          <span aria-hidden="true">↗</span>
        </button>
        <small>This preview never requests or stores account credentials.</small>
      </section>
    </div>
  );
}

function ProjectDetailPanel({
  project,
  onClose,
}: {
  project: ProjectOpening;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // The project panel mirrors the login panel's keyboard-safe close behavior.
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="project-detail-title"
        aria-modal="true"
        className="project-detail-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="detail-header">
          <div>
            <span className="eyebrow">{project.stage}</span>
            <h2 id="project-detail-title">{project.title}</h2>
          </div>
          <button
            aria-label="Close project details"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="detail-owner">
          <span aria-hidden="true" className="owner-avatar">{project.ownerName.charAt(0)}</span>
          <div><strong>{project.ownerName}</strong><span>{project.ownerSignal}</span></div>
        </div>

        <div className="detail-facts" aria-label="Opening facts">
          <div><span>Compensation</span><strong>{project.compensation}</strong></div>
          <div><span>Commitment</span><strong>{project.commitment}</strong></div>
          <div><span>Duration</span><strong>{project.duration}</strong></div>
          <div><span>Overlap</span><strong>{project.timezone}</strong></div>
        </div>

        <div className="detail-sections">
          <section><h3>Desired outcome</h3><p>{project.desiredOutcome}</p></section>
          <section className="milestone-callout"><h3>Two-week trial milestone</h3><p>{project.firstMilestone}</p></section>
          <section><h3>What the owner has already contributed</h3><p>{project.ownerContribution}</p></section>
          <section><h3>Access and confidentiality</h3><p>{project.confidentiality}</p></section>
        </div>

        <div className="detail-footer">
          <ul className="tag-list" aria-label="Skills for this opening">
            {project.skills.map((skill) => <li key={skill}>{skill}</li>)}
          </ul>
          <a className="primary-button" href="#early-access" onClick={onClose}>
            Request access to apply
          </a>
        </div>
      </section>
    </div>
  );
}

export function HomeExperience() {
  const [filters, setFilters] = useState<ProjectFilters>(defaultProjectFilters);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectOpening | null>(null);
  const [email, setEmail] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const projectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleProjects = useMemo(() => filterProjects(projects, filters), [filters]);
  const activeFilterCount = Number(filters.role !== 'All roles')
    + Number(filters.compensation !== 'All compensation')
    + Number(filters.commitment !== 'Any commitment');

  const updateFilter = <Key extends keyof ProjectFilters>(key: Key, value: ProjectFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const closeProjectDetails = () => {
    setSelectedProject(null);
    window.setTimeout(() => projectTriggerRef.current?.focus(), 0);
  };

  // This frontend-only form gives clear feedback without pretending an account was created.
  const handleEarlyAccess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setSignupMessage(`Thanks — ${normalizedEmail} is ready for the early-access integration.`);
    setEmail('');
  };

  return (
    <div className="site-shell">
      {/* Header: global identity, navigation, discovery search, login, and theme preference. */}
      <header className="site-header">
        <a aria-label="Branch-Out home" className="wordmark" href="#top">
          Branch<span>—Out</span>
        </a>

        <nav aria-label="Primary navigation" className="primary-nav">
          <a href="#openings">Openings</a>
          <a href="#trust">How trust works</a>
        </nav>

        <label className="header-search">
          <span className="sr-only">Search project openings</span>
          <span aria-hidden="true" className="search-symbol">⌕</span>
          <input
            aria-label="Search project openings"
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Search roles, skills, or projects"
            type="search"
            value={filters.query}
          />
          {filters.query && (
            <button aria-label="Clear search" onClick={() => updateFilter('query', '')} type="button">
              ×
            </button>
          )}
        </label>

        <div className="header-actions">
          <ThemeToggle />
          <button className="login-button" onClick={() => setIsLoginOpen(true)} type="button">
            Log in
          </button>
        </div>
      </header>

      <main id="top">
        {/* Body: a focused product promise followed by proof-led discovery. */}
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">Proof before partnership</span>
            <h1 id="hero-title">Build with people who can show how they work.</h1>
            <p>
              Find credible collaborators, start with a two-week milestone, and
              turn shared work into a reputation that means something.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#openings">Explore openings</a>
              <a className="text-link" href="#trust">See the trust model <span aria-hidden="true">→</span></a>
            </div>
          </div>

          <aside className="trial-card" aria-label="Two-week trial summary">
            <div className="trial-card-header">
              <span>First milestone</span>
              <strong>14 days</strong>
            </div>
            <h2>Ship the onboarding prototype</h2>
            <p>Clear scope, limited access, and an outcome both people confirm.</p>
            <div className="trial-progress" aria-label="Trial setup progress: 3 of 4 steps complete">
              <span className="complete" />
              <span className="complete" />
              <span className="complete" />
              <span />
            </div>
            <ul>
              <li><span aria-hidden="true">✓</span> Work sample reviewed</li>
              <li><span aria-hidden="true">✓</span> Availability confirmed</li>
              <li><span aria-hidden="true">✓</span> Repository scope agreed</li>
            </ul>
          </aside>
        </section>

        {/* Trust ladder: simple language makes every reputation signal understandable. */}
        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading compact-heading">
            <span className="eyebrow">A visible trust trail</span>
            <h2 id="trust-title">Claims become evidence. Evidence becomes confidence.</h2>
          </div>
          <ol className="trust-ladder">
            <li>
              <span className="step-number">01</span>
              <div><strong>Skill Screened</strong><p>Applied judgment tested in a short, practical challenge.</p></div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div><strong>Work Demonstrated</strong><p>A credible sample with the person’s contribution made clear.</p></div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div><strong>Collaboration Proven</strong><p>A teammate confirms the behavior they observed in shared work.</p></div>
            </li>
          </ol>
        </section>

        {/* Discovery: the header search filters realistic openings and reports its result count. */}
        <section className="openings-section" id="openings" aria-labelledby="openings-title">
          <div className="section-heading openings-heading">
            <div>
              <span className="eyebrow">Fresh opportunities</span>
              <h2 id="openings-title">Openings worth a closer look</h2>
            </div>
            <span className="result-count" aria-live="polite">
              {visibleProjects.length} {visibleProjects.length === 1 ? 'opening' : 'openings'}
            </span>
          </div>

          <div className="filter-bar" aria-label="Filter project openings">
            <label>
              <span>Role</span>
              <select
                aria-label="Filter by role"
                onChange={(event) => updateFilter('role', event.target.value as ProjectFilters['role'])}
                value={filters.role}
              >
                <option>All roles</option>
                {projectRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
            <label>
              <span>Compensation</span>
              <select
                aria-label="Filter by compensation"
                onChange={(event) => updateFilter('compensation', event.target.value as ProjectFilters['compensation'])}
                value={filters.compensation}
              >
                <option>All compensation</option>
                {compensationTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Weekly time</span>
              <select
                aria-label="Filter by weekly commitment"
                onChange={(event) => updateFilter('commitment', event.target.value as ProjectFilters['commitment'])}
                value={filters.commitment}
              >
                <option>Any commitment</option>
                {commitmentBands.map((band) => <option key={band}>{band}</option>)}
              </select>
            </label>
            <button
              className="reset-filters"
              disabled={activeFilterCount === 0 && !filters.query}
              onClick={() => setFilters(defaultProjectFilters)}
              type="button"
            >
              Reset {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
          </div>

          {visibleProjects.length > 0 ? (
            <div className="project-grid">
              {visibleProjects.map((project) => (
                <article className="project-card" key={project.id}>
                  <div className="project-topline">
                    <span className="compensation">{project.compensation}</span>
                    <span>{project.freshness}</span>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <ul className="tag-list" aria-label="Required skills">
                    {project.skills.map((skill) => <li key={skill}>{skill}</li>)}
                  </ul>
                  <dl className="project-details">
                    <div><dt>Commitment</dt><dd>{project.commitment}</dd></div>
                    <div><dt>Duration</dt><dd>{project.duration}</dd></div>
                    <div><dt>Overlap</dt><dd>{project.timezone}</dd></div>
                  </dl>
                  <button
                    className="card-action"
                    onClick={(event) => {
                      projectTriggerRef.current = event.currentTarget;
                      setSelectedProject(project);
                    }}
                    type="button"
                    aria-label={`View details for ${project.title}`}
                  >
                    View full opening <span aria-hidden="true">→</span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state" role="status">
              <strong>No openings match the current filters</strong>
              <p>Try a broader skill, role, compensation type, or weekly commitment.</p>
              <button onClick={() => setFilters(defaultProjectFilters)} type="button">Reset all filters</button>
            </div>
          )}
        </section>

        {/* Early access: provides a useful frontend interaction without fabricating persistence. */}
        <section className="early-access" id="early-access" aria-labelledby="early-access-title">
          <div>
            <span className="eyebrow">Build the first cohort</span>
            <h2 id="early-access-title">Good collaborations should not begin with guesswork.</h2>
          </div>
          <form onSubmit={handleEarlyAccess}>
            <label htmlFor="early-access-email">Email address</label>
            <div className="email-field">
              <input
                id="early-access-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <button type="submit">Request access</button>
            </div>
            {signupMessage && <p className="form-message" role="status">{signupMessage}</p>}
          </form>
        </section>
      </main>

      {/* Footer: concise product context, navigation, and trust expectations. */}
      <footer className="site-footer">
        <div>
          <a aria-label="Branch-Out home" className="wordmark" href="#top">Branch<span>—Out</span></a>
          <p>Find proof. Start small. Build trust through real work.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#openings">Browse openings</a>
          <a href="#trust">Trust model</a>
          <a href="#early-access">Early access</a>
        </nav>
        <p className="footer-note">© {new Date().getFullYear()} Branch-Out. Teams retain control of access, agreements, and intellectual property.</p>
      </footer>

      {isLoginOpen && <LoginPanel onClose={() => setIsLoginOpen(false)} />}
      {selectedProject && (
        <ProjectDetailPanel project={selectedProject} onClose={closeProjectDetails} />
      )}
    </div>
  );
}
