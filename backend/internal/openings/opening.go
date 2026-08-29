// Package openings owns project-opening domain types and discovery rules.
package openings

import (
	"context"
	"strings"
)

type Role string

const (
	RoleEngineering Role = "Engineering"
	RoleDesign      Role = "Design"
	RoleResearch    Role = "Research"
)

type Compensation string

const (
	CompensationPaid         Compensation = "Paid"
	CompensationFixedBounty  Compensation = "Fixed bounty"
	CompensationRevenueShare Compensation = "Revenue share"
	CompensationPortfolio    Compensation = "Portfolio"
)

type CommitmentBand string

const (
	CommitmentUnderSix   CommitmentBand = "Under 6 hrs/week"
	CommitmentSixToEight CommitmentBand = "6–8 hrs/week"
	CommitmentEightPlus  CommitmentBand = "8+ hrs/week"
)

type Opening struct {
	ID                string         `json:"id"`
	Title             string         `json:"title"`
	Summary           string         `json:"summary"`
	Skills            []string       `json:"skills"`
	Role              Role           `json:"role"`
	Compensation      Compensation   `json:"compensation"`
	Commitment        string         `json:"commitment"`
	CommitmentBand    CommitmentBand `json:"commitmentBand"`
	Duration          string         `json:"duration"`
	Timezone          string         `json:"timezone"`
	Freshness         string         `json:"freshness"`
	Stage             string         `json:"stage"`
	DesiredOutcome    string         `json:"desiredOutcome"`
	FirstMilestone    string         `json:"firstMilestone"`
	OwnerContribution string         `json:"ownerContribution"`
	OwnerName         string         `json:"ownerName"`
	OwnerSignal       string         `json:"ownerSignal"`
	Confidentiality   string         `json:"confidentiality"`
}

type Filters struct {
	Query        string
	Role         Role
	Compensation Compensation
	Commitment   CommitmentBand
}

type Repository interface {
	List(context.Context, Filters) ([]Opening, error)
}

func ValidRole(value Role) bool {
	return value == "" || value == RoleEngineering || value == RoleDesign || value == RoleResearch
}

func ValidCompensation(value Compensation) bool {
	return value == "" || value == CompensationPaid || value == CompensationFixedBounty || value == CompensationRevenueShare || value == CompensationPortfolio
}

func ValidCommitment(value CommitmentBand) bool {
	return value == "" || value == CommitmentUnderSix || value == CommitmentSixToEight || value == CommitmentEightPlus
}

func Matches(opening Opening, filters Filters) bool {
	searchable := strings.ToLower(strings.Join([]string{
		opening.Title, opening.Summary, strings.Join(opening.Skills, " "), string(opening.Role),
		string(opening.Compensation), opening.Commitment, opening.Duration, opening.Timezone, opening.Stage,
	}, " "))
	for _, term := range strings.Fields(strings.ToLower(filters.Query)) {
		if !strings.Contains(searchable, term) {
			return false
		}
	}

	return (filters.Role == "" || opening.Role == filters.Role) &&
		(filters.Compensation == "" || opening.Compensation == filters.Compensation) &&
		(filters.Commitment == "" || opening.CommitmentBand == filters.Commitment)
}
