'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectOpening } from '../data/projects';

const MAX_COMPARISON_PROJECTS = 3;

export function SavedProjectComparisonPanel({
  onClose,
  onViewProject,
  savedProjects,
}: {
  onClose: () => void;
  onViewProject: (project: ProjectOpening) => void;
  savedProjects: ProjectOpening[];
}) {
  const [selectedIds, setSelectedIds] = useState(
    savedProjects.slice(0, MAX_COMPARISON_PROJECTS).map((project) => project.id),
  );
  const [selectionMessage, setSelectionMessage] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Comparison is a keyboard-safe modal and never changes the saved shortlist.
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const selectedProjects = savedProjects.filter((project) => selectedIds.includes(project.id));

  const toggleProject = (project: ProjectOpening) => {
    const isSelected = selectedIds.includes(project.id);
    if (!isSelected && selectedIds.length >= MAX_COMPARISON_PROJECTS) {
      setSelectionMessage('Choose up to three openings. Remove one before adding another.');
      return;
    }

    setSelectedIds((currentIds) => (
      isSelected
        ? currentIds.filter((projectId) => projectId !== project.id)
        : [...currentIds, project.id]
    ));
    setSelectionMessage(
      isSelected
        ? `${project.title} removed from this comparison.`
        : `${project.title} added to this comparison.`,
    );
  };

  return (
    <div className="modal-backdrop comparison-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="comparison-title"
        aria-modal="true"
        className="comparison-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="comparison-header">
          <div>
            <span className="eyebrow">Saved opening comparison</span>
            <h2 id="comparison-title">Compare the work, not just the title.</h2>
            <p>Review concrete scope, commitment, proof, and trial terms side by side.</p>
          </div>
          <button
            aria-label="Close saved opening comparison"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>

        {/* Selection controls support larger shortlists without overcrowding the comparison. */}
        <fieldset className="comparison-picker">
          <legend>Choose two or three openings</legend>
          <div>
            {savedProjects.map((project) => {
              const isSelected = selectedIds.includes(project.id);
              return (
                <label className={isSelected ? 'selected' : ''} key={project.id}>
                  <input
                    checked={isSelected}
                    onChange={() => toggleProject(project)}
                    type="checkbox"
                  />
                  <span>{project.title}</span>
                </label>
              );
            })}
          </div>
          <p aria-live="polite" className="comparison-selection-message">
            {selectionMessage || `${selectedProjects.length} openings selected.`}
          </p>
        </fieldset>

        {selectedProjects.length >= 2 ? (
          <div
            aria-label={`Comparison of ${selectedProjects.length} saved openings`}
            className="comparison-grid"
            role="region"
          >
            {selectedProjects.map((project) => (
              <article className="comparison-card" key={project.id}>
                <div className="comparison-card-heading">
                  <span>{project.stage}</span>
                  <h3>{project.title}</h3>
                  <p>{project.ownerName} · {project.ownerSignal}</p>
                </div>
                <dl>
                  <div><dt>Compensation</dt><dd>{project.compensation}</dd></div>
                  <div><dt>Weekly time</dt><dd>{project.commitment}</dd></div>
                  <div><dt>Duration</dt><dd>{project.duration}</dd></div>
                  <div><dt>Overlap</dt><dd>{project.timezone}</dd></div>
                  <div className="comparison-wide-row"><dt>Two-week trial</dt><dd>{project.firstMilestone}</dd></div>
                  <div className="comparison-wide-row"><dt>Access</dt><dd>{project.confidentiality}</dd></div>
                </dl>
                <button
                  className="text-button comparison-view-button"
                  onClick={() => onViewProject(project)}
                  type="button"
                >
                  View this opening <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="comparison-empty" role="status">
            <strong>Select at least two openings to compare</strong>
            <p>The comparison will return as soon as a second opening is selected.</p>
          </div>
        )}

        <footer className="comparison-footer">
          <p>Comparison is a decision aid. Branch-Out does not rank people or choose an opening for you.</p>
          <button className="secondary-button" onClick={onClose} type="button">Done comparing</button>
        </footer>
      </section>
    </div>
  );
}
