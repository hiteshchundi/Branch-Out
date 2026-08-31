import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationAPIError,
  decideApplication,
  listSubmittedApplications,
  loadOwnApplication,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
  type ApplicationInput,
} from './applications';

const input: ApplicationInput = {
  message: 'I have built public climate dashboards and enjoy making complex data understandable.',
  workSampleUrl: 'https://github.com/example/climate-dashboard',
  workSampleContext: 'I designed and implemented the interactive comparison view.',
  availability: '7 hours each week, starting next Monday',
  availabilityConfirmed: true,
  proposedContribution: 'I can audit the current data flow and prototype the region selector.',
};

const application = {
  id: '61616161-6161-4161-a161-616161616161',
  openingId: 'climate-data-explorer',
  input,
  status: 'draft',
};

afterEach(() => vi.unstubAllGlobals());

describe('application API client', () => {
  it('loads the current member application with credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: application }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadOwnApplication(application.openingId)).resolves.toEqual(application);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings/climate-data-explorer/application',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('treats a missing own application as a new draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'application_not_found' },
    }), { status: 404 })));
    await expect(loadOwnApplication(application.openingId)).resolves.toBeNull();
  });

  it('saves a private draft and explicitly submits it', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: application }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...application, status: 'submitted' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await saveApplicationDraft(application.openingId, input);
    await submitApplication(application.openingId);
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/application$/), expect.objectContaining({ method: 'PUT', body: JSON.stringify(input) }));
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/application\/submit$/), expect.objectContaining({ method: 'POST' }));
  });

  it('lists submitted applications for an opening owner', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      ...application,
      status: 'submitted',
      submittedAt: '2026-08-31T08:00:00Z',
      decidedAt: null,
      withdrawnAt: null,
      applicant: {
        displayName: 'Asha Rao', primaryRole: 'Software developer', skills: ['Go', 'React'],
        githubUrl: 'https://github.com/asha', portfolioUrl: null,
        evidenceSummary: 'Shipped accessible collaboration tools with small teams.',
      },
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(listSubmittedApplications('opening/id')).resolves.toMatchObject([
      { status: 'submitted', applicant: { displayName: 'Asha Rao' } },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings/opening%2Fid/applications',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sends an explicit owner decision for one submitted application', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { ...application, status: 'accepted', decidedAt: '2026-08-31T09:00:00Z' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(decideApplication(application.openingId, application.id, 'accepted')).resolves.toMatchObject({ status: 'accepted' });
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${application.openingId}/applications/${application.id}/decision`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ decision: 'accepted' }) }),
    );
  });

  it('withdraws the applicant submission through its own endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { ...application, status: 'withdrawn', withdrawnAt: '2026-08-31T10:00:00Z' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(withdrawApplication(application.openingId)).resolves.toMatchObject({ status: 'withdrawn' });
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${application.openingId}/application/withdraw`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('preserves API errors and rejects malformed successes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'profile_required', field: 'message' },
    }), { status: 409 })));
    await expect(saveApplicationDraft(application.openingId, input)).rejects.toEqual(
      new ApplicationAPIError(409, 'profile_required', 'message'),
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...application, status: 'unknown' } }), { status: 200 })));
    await expect(loadOwnApplication(application.openingId)).rejects.toThrow(/invalid application/i);
  });
});
