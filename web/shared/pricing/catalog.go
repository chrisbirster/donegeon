package pricing

import (
	_ "embed"
	"encoding/json"
	"strings"
)

const (
	EntitlementQuickAdd              = "quick_add"
	EntitlementRecurringSchedules    = "recurring_schedules"
	EntitlementPersonalBoardGameplay = "personal_board_gameplay"
	EntitlementCalendarSync          = "calendar_sync"
	EntitlementPWAOffline            = "pwa_offline"
	EntitlementSharedTeamBoards      = "shared_team_boards"
	EntitlementWorkspaceInvites      = "workspace_invites"
	EntitlementTeamRoles             = "team_roles"
	EntitlementTeamAdmin             = "team_admin"
	EntitlementBoardMemberManagement = "board_member_management"
	EntitlementGuidedMigration       = "guided_migration"
	EntitlementSecurityReviewSupport = "security_review_support"
	EntitlementProcurementSupport    = "procurement_support"
	EntitlementPriorityMigration     = "priority_migration_support"
)

type WorkspacePlanMapping struct {
	PlanFamily   string `json:"planFamily"`
	BillingState string `json:"billingState"`
}

type PlanFamily struct {
	Label           string   `json:"label"`
	ComparisonLabel string   `json:"comparisonLabel"`
	Price           string   `json:"price"`
	Cadence         string   `json:"cadence"`
	Description     string   `json:"description"`
	CTALabel        string   `json:"ctaLabel"`
	WaitlistLabel   string   `json:"waitlistLabel"`
	LoginPlan       string   `json:"loginPlan"`
	ContactHref     string   `json:"contactHref"`
	Featured        bool     `json:"featured"`
	Bullets         []string `json:"bullets"`
	Entitlements    []string `json:"entitlements"`
}

type PricingMatrixRow struct {
	Key        string `json:"key"`
	Label      string `json:"label"`
	Free       string `json:"free"`
	Pro        string `json:"pro"`
	Enterprise string `json:"enterprise"`
}

type PricingMatrixGroup struct {
	Title string             `json:"title"`
	Rows  []PricingMatrixRow `json:"rows"`
}

type FAQ struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type FeatureInventoryItem struct {
	Key          string `json:"key"`
	Label        string `json:"label"`
	Category     string `json:"category"`
	Availability string `json:"availability"`
	Status       string `json:"status"`
}

type ListItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

type Catalog struct {
	Version               int                             `json:"version"`
	WorkspacePlanMappings map[string]WorkspacePlanMapping `json:"workspacePlanMappings"`
	PublicPlanOrder       []string                        `json:"publicPlanOrder"`
	PlanFamilies          map[string]PlanFamily           `json:"planFamilies"`
	PricingMatrix         []PricingMatrixGroup            `json:"pricingMatrix"`
	FAQs                  []FAQ                           `json:"faqs"`
	FeatureInventory      []FeatureInventoryItem          `json:"featureInventory"`
	SeparateAddOns        []ListItem                      `json:"separateAddOns"`
	NotYetPubliclyTiered  []ListItem                      `json:"notYetPubliclyTiered"`
}

type WorkspacePlanProfile struct {
	WorkspacePlan string
	PlanFamily    string
	BillingState  string
	DisplayLabel  string
	Entitlements  []string
}

//go:embed tiers.json
var rawCatalog []byte

var catalog = mustLoadCatalog()

func CatalogData() Catalog {
	return cloneCatalog(catalog)
}

func LookupWorkspacePlan(raw string) WorkspacePlanProfile {
	normalized := NormalizeWorkspacePlan(raw)
	mapping, ok := catalog.WorkspacePlanMappings[normalized]
	if !ok {
		normalized = "personal"
		mapping = catalog.WorkspacePlanMappings[normalized]
	}
	family := catalog.PlanFamilies[mapping.PlanFamily]
	return WorkspacePlanProfile{
		WorkspacePlan: normalized,
		PlanFamily:    mapping.PlanFamily,
		BillingState:  mapping.BillingState,
		DisplayLabel:  family.Label,
		Entitlements:  append([]string{}, family.Entitlements...),
	}
}

func NormalizeWorkspacePlan(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "free", "personal":
		return "personal"
	case "pro_trial":
		return "pro_trial"
	case "pro":
		return "pro"
	case "enterprise":
		return "enterprise"
	default:
		return "personal"
	}
}

func HasEntitlement(entitlements []string, key string) bool {
	needle := strings.TrimSpace(key)
	if needle == "" {
		return false
	}
	for _, entitlement := range entitlements {
		if strings.TrimSpace(entitlement) == needle {
			return true
		}
	}
	return false
}

func mustLoadCatalog() Catalog {
	var parsed Catalog
	if err := json.Unmarshal(rawCatalog, &parsed); err != nil {
		panic(err)
	}
	return cloneCatalog(parsed)
}

func cloneCatalog(source Catalog) Catalog {
	cloned := source
	cloned.PublicPlanOrder = append([]string{}, source.PublicPlanOrder...)
	cloned.PlanFamilies = make(map[string]PlanFamily, len(source.PlanFamilies))
	for key, family := range source.PlanFamilies {
		next := family
		next.Bullets = append([]string{}, family.Bullets...)
		next.Entitlements = append([]string{}, family.Entitlements...)
		cloned.PlanFamilies[key] = next
	}
	cloned.WorkspacePlanMappings = make(map[string]WorkspacePlanMapping, len(source.WorkspacePlanMappings))
	for key, mapping := range source.WorkspacePlanMappings {
		cloned.WorkspacePlanMappings[key] = mapping
	}
	cloned.PricingMatrix = make([]PricingMatrixGroup, 0, len(source.PricingMatrix))
	for _, group := range source.PricingMatrix {
		next := group
		next.Rows = append([]PricingMatrixRow{}, group.Rows...)
		cloned.PricingMatrix = append(cloned.PricingMatrix, next)
	}
	cloned.FAQs = append([]FAQ{}, source.FAQs...)
	cloned.FeatureInventory = append([]FeatureInventoryItem{}, source.FeatureInventory...)
	cloned.SeparateAddOns = append([]ListItem{}, source.SeparateAddOns...)
	cloned.NotYetPubliclyTiered = append([]ListItem{}, source.NotYetPubliclyTiered...)
	return cloned
}
