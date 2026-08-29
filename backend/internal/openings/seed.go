package openings

// Seed mirrors the representative frontend catalogue until PostgreSQL becomes
// the single source of truth in the persistence milestone.
func Seed() []Opening {
	return []Opening{
		{
			ID: "climate-data-explorer", Title: "Frontend engineer for a climate data explorer",
			Summary: "Turn open emissions data into a fast, understandable planning tool for local teams.",
			Skills:  []string{"TypeScript", "React", "Data visualization"}, Role: RoleEngineering,
			Compensation: CompensationFixedBounty, Commitment: "6–8 hrs/week", CommitmentBand: CommitmentSixToEight,
			Duration: "6 weeks", Timezone: "UTC to UTC+4", Freshness: "Posted 2h ago", Stage: "Working prototype",
			DesiredOutcome:    "A responsive explorer that turns regional emissions data into decisions a local planning team can explain.",
			FirstMilestone:    "Build and document the interactive region-comparison view using the existing API.",
			OwnerContribution: "Data model, API, user interviews, and a deployed internal prototype are ready.",
			OwnerName:         "Maya Chen", OwnerSignal: "Collaboration Proven · 3 projects",
			Confidentiality: "Public project with limited repository access during the trial.",
		},
		{
			ID: "accessible-finance", Title: "Product designer for an accessible finance app",
			Summary: "Shape a privacy-first cash-flow experience for freelancers with variable income.",
			Skills:  []string{"Product design", "Figma", "Accessibility"}, Role: RoleDesign,
			Compensation: CompensationPaid, Commitment: "5 hrs/week", CommitmentBand: CommitmentUnderSix,
			Duration: "4 weeks", Timezone: "UTC+1 to UTC+5:30", Freshness: "Posted yesterday", Stage: "Validated concept",
			DesiredOutcome:    "A tested mobile-first flow that helps freelancers see upcoming cash gaps without exposing bank credentials.",
			FirstMilestone:    "Review six interview notes and produce a clickable weekly cash-flow prototype.",
			OwnerContribution: "Research synthesis, compliance constraints, and the first information architecture are complete.",
			OwnerName:         "Noah Williams", OwnerSignal: "Work Demonstrated · 2 shipped products",
			Confidentiality: "Limited details until both people accept a short confidentiality agreement.",
		},
		{
			ID: "research-assistant", Title: "Full-stack builder for an AI research assistant",
			Summary: "Prototype a citation-first workspace that helps small research teams review evidence.",
			Skills:  []string{"Next.js", "Python", "LLM evaluation"}, Role: RoleEngineering,
			Compensation: CompensationRevenueShare, Commitment: "8–10 hrs/week", CommitmentBand: CommitmentEightPlus,
			Duration: "8 weeks", Timezone: "UTC-5 to UTC+1", Freshness: "Posted 2 days ago", Stage: "Private alpha",
			DesiredOutcome:    "A reliable evidence-review loop where every generated claim stays connected to a source passage.",
			FirstMilestone:    "Implement the citation inspection flow against a fixed evaluation set of 40 documents.",
			OwnerContribution: "Retrieval service, evaluation rubric, and five alpha teams are already in place.",
			OwnerName:         "Elena García", OwnerSignal: "Skill Screened · AI evaluation",
			Confidentiality: "Confidential dataset; the trial uses a sandbox and synthetic documents.",
		},
		{
			ID: "open-source-onboarding", Title: "UX researcher for open-source contributor onboarding",
			Summary: "Find the friction that stops capable developers from making their first useful contribution.",
			Skills:  []string{"User research", "Journey mapping", "Open source"}, Role: RoleResearch,
			Compensation: CompensationPortfolio, Commitment: "4–5 hrs/week", CommitmentBand: CommitmentUnderSix,
			Duration: "3 weeks", Timezone: "UTC-2 to UTC+5:30", Freshness: "Posted 3 days ago", Stage: "Active community",
			DesiredOutcome:    "A prioritized onboarding plan grounded in interviews with new and recently retained contributors.",
			FirstMilestone:    "Run three structured interviews and deliver a friction map with supporting evidence.",
			OwnerContribution: "Recruiting access, analytics, community moderation, and an interview guide are provided.",
			OwnerName:         "Arjun Mehta", OwnerSignal: "Collaboration Proven · 5 projects",
			Confidentiality: "Public research; participants remain anonymous in published notes.",
		},
		{
			ID: "developer-portfolio", Title: "Visual designer for a calm developer portfolio system",
			Summary: "Create a reusable visual language for engineers who want their work—not decoration—to lead.",
			Skills:  []string{"Visual design", "Design systems", "Typography"}, Role: RoleDesign,
			Compensation: CompensationFixedBounty, Commitment: "6 hrs/week", CommitmentBand: CommitmentSixToEight,
			Duration: "5 weeks", Timezone: "UTC+3 to UTC+8", Freshness: "Posted 4 days ago", Stage: "Design brief",
			DesiredOutcome:    "A flexible portfolio kit with restrained typography, accessible themes, and strong project storytelling.",
			FirstMilestone:    "Establish typography, spacing, and color tokens, then apply them to one case-study page.",
			OwnerContribution: "Content model, component inventory, and three complete case studies are available.",
			OwnerName:         "Sofia Kim", OwnerSignal: "Work Demonstrated · design engineering",
			Confidentiality: "Public project; all reusable assets will have an explicit open-source license.",
		},
	}
}
