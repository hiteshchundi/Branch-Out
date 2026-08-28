import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../data/projects';
import { deriveTrustSignalPreview, OutcomeFeedbackPanel, outcomeFeedbackStorageKey, type OutcomeFeedbackDraft, validateOutcomeStep } from './outcome-feedback-panel';

const project = projects[0];
const completeDraft: OutcomeFeedbackDraft = { outcomeStatus: 'Completed', deliverableStatus: 'Met', workSummary: 'Delivered a tested regional comparison with clear implementation notes.', evidenceUrl: 'https://github.com/example/climate-map', behaviors: ['Reliable delivery', 'Clear communication', 'Sound scope judgment'], collaborationExample: 'Raised an API limitation early and proposed a smaller testable alternative.', collaborateAgain: 'Yes', publicSummary: 'Delivered the agreed comparison and communicated scope decisions clearly throughout.', privacyConfirmed: true, mutualReviewConfirmed: true };

describe('outcome feedback rules', () => {
  it('validates only the visible step', () => { const errors = validateOutcomeStep({ ...completeDraft, workSummary: '' }, 0); expect(errors.workSummary).toMatch(/30 characters/i); expect(errors.behaviors).toBeUndefined(); });
  it('rejects unsafe evidence links and unsupported claims', () => { expect(validateOutcomeStep({ ...completeDraft, evidenceUrl: 'javascript:alert(1)' }, 0).evidenceUrl).toMatch(/http or https/i); expect(validateOutcomeStep({ ...completeDraft, behaviors: ['Reliable delivery'] }, 1).behaviors).toMatch(/at least two/i); });
  it('derives a transparent Collaboration Proven candidate', () => { const preview = deriveTrustSignalPreview(completeDraft); expect(preview.title).toBe('Collaboration Proven candidate'); expect(preview.factors).toContain('3 observed collaboration behaviors'); });
  it('falls back without overstating weaker outcomes', () => { expect(deriveTrustSignalPreview({ ...completeDraft, outcomeStatus: 'Partially completed' }).title).toBe('Work Demonstrated candidate'); expect(deriveTrustSignalPreview({ ...completeDraft, outcomeStatus: 'Stopped early' }).title).toBe('No trust signal candidate'); });
});

describe('OutcomeFeedbackPanel', () => {
  beforeEach(() => localStorage.clear());
  it('shows accessible outcome validation', () => { render(<OutcomeFeedbackPanel onClose={vi.fn()} project={project} />); fireEvent.click(screen.getByRole('button', { name: /continue/i })); expect(screen.getByText(/choose how the trial ended/i)).toBeInTheDocument(); expect(screen.getByLabelText(/trial status/i)).toHaveAttribute('aria-invalid', 'true'); });
  it('restores and saves a project-specific draft', () => { localStorage.setItem(outcomeFeedbackStorageKey(project.id), JSON.stringify(completeDraft)); render(<OutcomeFeedbackPanel onClose={vi.fn()} project={project} />); expect(screen.getByLabelText(/what was delivered/i)).toHaveValue(completeDraft.workSummary); fireEvent.click(screen.getByRole('button', { name: /save draft/i })); expect(screen.getByText(/outcome review draft saved/i)).toBeInTheDocument(); });
  it('completes without publishing a trust signal', () => { localStorage.setItem(outcomeFeedbackStorageKey(project.id), JSON.stringify(completeDraft)); render(<OutcomeFeedbackPanel onClose={vi.fn()} project={project} />); fireEvent.click(screen.getByRole('button', { name: /continue/i })); fireEvent.click(screen.getByRole('button', { name: /continue/i })); fireEvent.click(screen.getByRole('button', { name: /complete outcome draft/i })); const status = screen.getByRole('status'); expect(status).toHaveTextContent('Collaboration Proven candidate'); expect(status).toHaveTextContent(/No trust signal or feedback has been published/i); });
  it('closes with Escape', () => { const onClose = vi.fn(); render(<OutcomeFeedbackPanel onClose={onClose} project={project} />); fireEvent.keyDown(window, { key: 'Escape' }); expect(onClose).toHaveBeenCalledOnce(); });
});
