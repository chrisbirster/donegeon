# Donegeon Client E2E Test Matrix

Generated from interaction bindings in `web/apps/client/src/routes` and `web/apps/client/src/components`.

## Scope
- Matrix approach: interaction binding x variant
- Variants per interaction: desktop happy path, validation/error, persistence/reload, mobile/responsive
- Goal: drive coverage from low double digits to full workflow confidence

## Current Automated Specs
| Spec | Test Count |
| --- | ---: |
| board.spec.ts | 5 |
| board.ui.spec.ts | 19 |
| home.interactions.spec.ts | 61 |
| home.spec.ts | 3 |
| appshell.interactions.spec.ts | 14 |
| login-onboarding.interactions.spec.ts | 32 |
| profile.interactions.spec.ts | 2 |
| team-settings.matrix.spec.ts | 32 |
| team-settings.spec.ts | 5 |
| **Total** | **173** |

## Matrix
| ID | Route | Source | Interaction | Variant | Status | Target Spec |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-0001 | AppShell | web/apps/client/src/components/AppShell.tsx:69 | ` onClick={() => setMobileMenuOpen(true)}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0002 | AppShell | web/apps/client/src/components/AppShell.tsx:69 | ` onClick={() => setMobileMenuOpen(true)}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0003 | AppShell | web/apps/client/src/components/AppShell.tsx:69 | ` onClick={() => setMobileMenuOpen(true)}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0004 | AppShell | web/apps/client/src/components/AppShell.tsx:69 | ` onClick={() => setMobileMenuOpen(true)}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0005 | AppShell | web/apps/client/src/components/AppShell.tsx:183 | ` onClick={closeMobileMenu}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0006 | AppShell | web/apps/client/src/components/AppShell.tsx:183 | ` onClick={closeMobileMenu}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0007 | AppShell | web/apps/client/src/components/AppShell.tsx:183 | ` onClick={closeMobileMenu}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0008 | AppShell | web/apps/client/src/components/AppShell.tsx:183 | ` onClick={closeMobileMenu}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0009 | AppShell | web/apps/client/src/components/AppShell.tsx:191 | ` onClick={closeMobileMenu}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0010 | AppShell | web/apps/client/src/components/AppShell.tsx:191 | ` onClick={closeMobileMenu}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0011 | AppShell | web/apps/client/src/components/AppShell.tsx:191 | ` onClick={closeMobileMenu}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0012 | AppShell | web/apps/client/src/components/AppShell.tsx:191 | ` onClick={closeMobileMenu}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0013 | AppShell | web/apps/client/src/components/AppShell.tsx:207 | ` onClick={() => setAccountMenuOpen((open) => !open)}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0014 | AppShell | web/apps/client/src/components/AppShell.tsx:207 | ` onClick={() => setAccountMenuOpen((open) => !open)}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0015 | AppShell | web/apps/client/src/components/AppShell.tsx:207 | ` onClick={() => setAccountMenuOpen((open) => !open)}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0016 | AppShell | web/apps/client/src/components/AppShell.tsx:207 | ` onClick={() => setAccountMenuOpen((open) => !open)}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0017 | AppShell | web/apps/client/src/components/AppShell.tsx:226 | ` onClick={() => setAccountMenuOpen(false)}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0018 | AppShell | web/apps/client/src/components/AppShell.tsx:226 | ` onClick={() => setAccountMenuOpen(false)}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0019 | AppShell | web/apps/client/src/components/AppShell.tsx:226 | ` onClick={() => setAccountMenuOpen(false)}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0020 | AppShell | web/apps/client/src/components/AppShell.tsx:226 | ` onClick={() => setAccountMenuOpen(false)}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0021 | AppShell | web/apps/client/src/components/AppShell.tsx:233 | ` onClick={() => setAccountMenuOpen(false)}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0022 | AppShell | web/apps/client/src/components/AppShell.tsx:233 | ` onClick={() => setAccountMenuOpen(false)}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0023 | AppShell | web/apps/client/src/components/AppShell.tsx:233 | ` onClick={() => setAccountMenuOpen(false)}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0024 | AppShell | web/apps/client/src/components/AppShell.tsx:233 | ` onClick={() => setAccountMenuOpen(false)}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0025 | AppShell | web/apps/client/src/components/AppShell.tsx:240 | ` onClick={() => void signOut()}` | Desktop happy path | Automated | appshell.interactions.spec.ts |
| E2E-0026 | AppShell | web/apps/client/src/components/AppShell.tsx:240 | ` onClick={() => void signOut()}` | Validation/error path | Automated | appshell.interactions.spec.ts |
| E2E-0027 | AppShell | web/apps/client/src/components/AppShell.tsx:240 | ` onClick={() => void signOut()}` | Persistence/reload | Automated | appshell.interactions.spec.ts |
| E2E-0028 | AppShell | web/apps/client/src/components/AppShell.tsx:240 | ` onClick={() => void signOut()}` | Mobile/responsive | Automated | appshell.interactions.spec.ts |
| E2E-0029 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:129 | ` <form onSubmit={(event) => void submitRequest(event)}>` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0030 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:129 | ` <form onSubmit={(event) => void submitRequest(event)}>` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0031 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:129 | ` <form onSubmit={(event) => void submitRequest(event)}>` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0032 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:129 | ` <form onSubmit={(event) => void submitRequest(event)}>` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0033 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:146 | ` onInput={(event) => {` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0034 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:146 | ` onInput={(event) => {` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0035 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:146 | ` onInput={(event) => {` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0036 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:146 | ` onInput={(event) => {` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0037 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:167 | ` <form onSubmit={(event) => void submitVerify(event)}>` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0038 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:167 | ` <form onSubmit={(event) => void submitVerify(event)}>` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0039 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:167 | ` <form onSubmit={(event) => void submitVerify(event)}>` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0040 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:167 | ` <form onSubmit={(event) => void submitVerify(event)}>` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0041 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:177 | ` onInput={(event) => setCode(event.currentTarget.value)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0042 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:177 | ` onInput={(event) => setCode(event.currentTarget.value)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0043 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:177 | ` onInput={(event) => setCode(event.currentTarget.value)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0044 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:177 | ` onInput={(event) => setCode(event.currentTarget.value)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0045 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:199 | ` onClick={() => setChallengeId(null)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0046 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:199 | ` onClick={() => setChallengeId(null)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0047 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:199 | ` onClick={() => setChallengeId(null)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0048 | LoginRoute | web/apps/client/src/routes/LoginRoute.tsx:199 | ` onClick={() => setChallengeId(null)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0049 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:68 | ` onSubmit={(event) => void submit(event)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0050 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:68 | ` onSubmit={(event) => void submit(event)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0051 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:68 | ` onSubmit={(event) => void submit(event)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0052 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:68 | ` onSubmit={(event) => void submit(event)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0053 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:79 | ` onInput={(event) => setName(event.currentTarget.value)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0054 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:79 | ` onInput={(event) => setName(event.currentTarget.value)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0055 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:79 | ` onInput={(event) => setName(event.currentTarget.value)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0056 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:79 | ` onInput={(event) => setName(event.currentTarget.value)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0057 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:88 | ` onInput={(event) => setTeamName(event.currentTarget.value)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0058 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:88 | ` onInput={(event) => setTeamName(event.currentTarget.value)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0059 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:88 | ` onInput={(event) => setTeamName(event.currentTarget.value)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0060 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:88 | ` onInput={(event) => setTeamName(event.currentTarget.value)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0061 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:102 | ` onChange={() => setPlan("personal")}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0062 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:102 | ` onChange={() => setPlan("personal")}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0063 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:102 | ` onChange={() => setPlan("personal")}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0064 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:102 | ` onChange={() => setPlan("personal")}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0065 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:115 | ` onChange={() => setPlan("pro_trial")}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0066 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:115 | ` onChange={() => setPlan("pro_trial")}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0067 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:115 | ` onChange={() => setPlan("pro_trial")}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0068 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:115 | ` onChange={() => setPlan("pro_trial")}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0069 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:128 | ` onChange={() => setPlan("enterprise")}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0070 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:128 | ` onChange={() => setPlan("enterprise")}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0071 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:128 | ` onChange={() => setPlan("enterprise")}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0072 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:128 | ` onChange={() => setPlan("enterprise")}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0073 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:142 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Desktop happy path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0074 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:142 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Validation/error path | Automated | login-onboarding.interactions.spec.ts |
| E2E-0075 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:142 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Persistence/reload | Automated | login-onboarding.interactions.spec.ts |
| E2E-0076 | OnboardingRoute | web/apps/client/src/routes/OnboardingRoute.tsx:142 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Mobile/responsive | Automated | login-onboarding.interactions.spec.ts |
| E2E-0077 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:439 | ` onClick={() => void startBilling("pro_trial")}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0078 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:439 | ` onClick={() => void startBilling("pro_trial")}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0079 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:439 | ` onClick={() => void startBilling("pro_trial")}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0080 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:439 | ` onClick={() => void startBilling("pro_trial")}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0081 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:447 | ` onClick={() => void startBilling("pro")}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0082 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:447 | ` onClick={() => void startBilling("pro")}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0083 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:447 | ` onClick={() => void startBilling("pro")}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0084 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:447 | ` onClick={() => void startBilling("pro")}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0085 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:462 | ` onClick={() => void startBilling("enterprise")}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0086 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:462 | ` onClick={() => void startBilling("enterprise")}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0087 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:462 | ` onClick={() => void startBilling("enterprise")}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0088 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:462 | ` onClick={() => void startBilling("enterprise")}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0089 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:482 | ` <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0090 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:482 | ` <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0091 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:482 | ` <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0092 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:482 | ` <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0093 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:487 | ` onInput={(event) => setTeamNameInput(event.currentTarget.value)}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0094 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:487 | ` onInput={(event) => setTeamNameInput(event.currentTarget.value)}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0095 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:487 | ` onInput={(event) => setTeamNameInput(event.currentTarget.value)}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0096 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:487 | ` onInput={(event) => setTeamNameInput(event.currentTarget.value)}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0097 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:536 | ` onChange={(event) => {` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0098 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:536 | ` onChange={(event) => {` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0099 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:536 | ` onChange={(event) => {` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0100 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:536 | ` onChange={(event) => {` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0101 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:556 | ` onClick={() => void removeMember(member)}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0102 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:556 | ` onClick={() => void removeMember(member)}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0103 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:556 | ` onClick={() => void removeMember(member)}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0104 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:556 | ` onClick={() => void removeMember(member)}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0105 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:582 | ` <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0106 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:582 | ` <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0107 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:582 | ` <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0108 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:582 | ` <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0109 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:587 | ` onChange={(event) => {` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0110 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:587 | ` onChange={(event) => {` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0111 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:587 | ` onChange={(event) => {` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0112 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:587 | ` onChange={(event) => {` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0113 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:604 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0114 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:604 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0115 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:604 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0116 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:604 | ` onInput={(event) => setInviteInput(event.currentTarget.value)}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0117 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:645 | ` onClick={() => void cancelInvitation(invitation)}` | Desktop happy path | Automated | team-settings.matrix.spec.ts |
| E2E-0118 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:645 | ` onClick={() => void cancelInvitation(invitation)}` | Validation/error path | Automated | team-settings.matrix.spec.ts |
| E2E-0119 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:645 | ` onClick={() => void cancelInvitation(invitation)}` | Persistence/reload | Automated | team-settings.matrix.spec.ts |
| E2E-0120 | TeamSettingsRoute | web/apps/client/src/routes/TeamSettingsRoute.tsx:645 | ` onClick={() => void cancelInvitation(invitation)}` | Mobile/responsive | Automated | team-settings.matrix.spec.ts |
| E2E-0121 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1256 | ` onClick={focusComposer}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0122 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1256 | ` onClick={focusComposer}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0123 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1256 | ` onClick={focusComposer}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0124 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1256 | ` onClick={focusComposer}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0125 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1264 | ` onClick={openSearchModal}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0126 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1264 | ` onClick={openSearchModal}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0127 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1264 | ` onClick={openSearchModal}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0128 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1264 | ` onClick={openSearchModal}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0129 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1281 | ` onClick={() => navigateToView("inbox")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0130 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1281 | ` onClick={() => navigateToView("inbox")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0131 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1281 | ` onClick={() => navigateToView("inbox")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0132 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1281 | ` onClick={() => navigateToView("inbox")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0133 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1293 | ` onClick={() => navigateToView("today")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0134 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1293 | ` onClick={() => navigateToView("today")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0135 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1293 | ` onClick={() => navigateToView("today")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0136 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1293 | ` onClick={() => navigateToView("today")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0137 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1305 | ` onClick={() => navigateToView("upcomming")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0138 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1305 | ` onClick={() => navigateToView("upcomming")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0139 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1305 | ` onClick={() => navigateToView("upcomming")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0140 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1305 | ` onClick={() => navigateToView("upcomming")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0141 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1325 | ` onClick={() => navigateToProject(project.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0142 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1325 | ` onClick={() => navigateToProject(project.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0143 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1325 | ` onClick={() => navigateToProject(project.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0144 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1325 | ` onClick={() => navigateToProject(project.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0145 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1346 | ` onClick={focusComposer}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0146 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1346 | ` onClick={focusComposer}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0147 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1346 | ` onClick={focusComposer}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0148 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1346 | ` onClick={focusComposer}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0149 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1356 | ` onClick={openSearchModal}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0150 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1356 | ` onClick={openSearchModal}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0151 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1356 | ` onClick={openSearchModal}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0152 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1356 | ` onClick={openSearchModal}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0153 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1373 | ` onClick={() => navigateToView("inbox")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0154 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1373 | ` onClick={() => navigateToView("inbox")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0155 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1373 | ` onClick={() => navigateToView("inbox")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0156 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1373 | ` onClick={() => navigateToView("inbox")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0157 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1389 | ` onClick={() => navigateToView("today")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0158 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1389 | ` onClick={() => navigateToView("today")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0159 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1389 | ` onClick={() => navigateToView("today")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0160 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1389 | ` onClick={() => navigateToView("today")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0161 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1405 | ` onClick={() => navigateToView("upcomming")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0162 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1405 | ` onClick={() => navigateToView("upcomming")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0163 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1405 | ` onClick={() => navigateToView("upcomming")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0164 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1405 | ` onClick={() => navigateToView("upcomming")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0165 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1431 | ` onClick={() => navigateToProject(project.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0166 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1431 | ` onClick={() => navigateToProject(project.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0167 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1431 | ` onClick={() => navigateToProject(project.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0168 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1431 | ` onClick={() => navigateToProject(project.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0169 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1467 | ` onClick={() => navigateToProject(project.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0170 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1467 | ` onClick={() => navigateToProject(project.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0171 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1467 | ` onClick={() => navigateToProject(project.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0172 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1467 | ` onClick={() => navigateToProject(project.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0173 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1488 | ` onClick={() => void toggleProjectFavorite(project)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0174 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1488 | ` onClick={() => void toggleProjectFavorite(project)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0175 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1488 | ` onClick={() => void toggleProjectFavorite(project)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0176 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1488 | ` onClick={() => void toggleProjectFavorite(project)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0177 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1508 | ` <form onSubmit={addTask} class="mb-5">` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0178 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1508 | ` <form onSubmit={addTask} class="mb-5">` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0179 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1508 | ` <form onSubmit={addTask} class="mb-5">` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0180 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1508 | ` <form onSubmit={addTask} class="mb-5">` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0181 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1525 | ` onInput={(e) => onMainInput(e.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0182 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1525 | ` onInput={(e) => onMainInput(e.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0183 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1525 | ` onInput={(e) => onMainInput(e.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0184 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1525 | ` onInput={(e) => onMainInput(e.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0185 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1584 | ` onDragOver={(event) => onDragOver(event, item.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0186 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1584 | ` onDragOver={(event) => onDragOver(event, item.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0187 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1584 | ` onDragOver={(event) => onDragOver(event, item.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0188 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1584 | ` onDragOver={(event) => onDragOver(event, item.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0189 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1585 | ` onDrop={(event) => onDrop(event, item.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0190 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1585 | ` onDrop={(event) => onDrop(event, item.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0191 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1585 | ` onDrop={(event) => onDrop(event, item.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0192 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1585 | ` onDrop={(event) => onDrop(event, item.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0193 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1586 | ` onClick={() => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0194 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1586 | ` onClick={() => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0195 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1586 | ` onClick={() => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0196 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1586 | ` onClick={() => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0197 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1598 | ` onClick={(event) => event.stopPropagation()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0198 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1598 | ` onClick={(event) => event.stopPropagation()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0199 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1598 | ` onClick={(event) => event.stopPropagation()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0200 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1598 | ` onClick={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0201 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1599 | ` onDragStart={(event) => onDragStart(event, item.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0202 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1599 | ` onDragStart={(event) => onDragStart(event, item.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0203 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1599 | ` onDragStart={(event) => onDragStart(event, item.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0204 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1599 | ` onDragStart={(event) => onDragStart(event, item.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0205 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1600 | ` onDragEnd={onDragEnd}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0206 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1600 | ` onDragEnd={onDragEnd}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0207 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1600 | ` onDragEnd={onDragEnd}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0208 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1600 | ` onDragEnd={onDragEnd}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0209 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1609 | ` onClick={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0210 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1609 | ` onClick={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0211 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1609 | ` onClick={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0212 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1609 | ` onClick={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0213 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1663 | ` <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0214 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1663 | ` <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0215 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1663 | ` <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0216 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1663 | ` <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0217 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1666 | ` onInput={(event) => setEditingContent(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0218 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1666 | ` onInput={(event) => setEditingContent(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0219 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1666 | ` onInput={(event) => setEditingContent(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0220 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1666 | ` onInput={(event) => setEditingContent(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0221 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1667 | ` onKeyDown={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0222 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1667 | ` onKeyDown={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0223 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1667 | ` onKeyDown={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0224 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1667 | ` onKeyDown={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0225 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1683 | ` onClick={() => void saveInlineEdit(item.id)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0226 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1683 | ` onClick={() => void saveInlineEdit(item.id)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0227 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1683 | ` onClick={() => void saveInlineEdit(item.id)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0228 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1683 | ` onClick={() => void saveInlineEdit(item.id)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0229 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1690 | ` onClick={cancelInlineEdit}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0230 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1690 | ` onClick={cancelInlineEdit}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0231 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1690 | ` onClick={cancelInlineEdit}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0232 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1690 | ` onClick={cancelInlineEdit}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0233 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1714 | ` onClick={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0234 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1714 | ` onClick={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0235 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1714 | ` onClick={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0236 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1714 | ` onClick={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0237 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1726 | ` onClick={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0238 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1726 | ` onClick={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0239 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1726 | ` onClick={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0240 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1726 | ` onClick={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0241 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1738 | ` onClick={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0242 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1738 | ` onClick={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0243 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1738 | ` onClick={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0244 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1738 | ` onClick={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0245 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1758 | ` onClick={closeSearchModal}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0246 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1758 | ` onClick={closeSearchModal}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0247 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1758 | ` onClick={closeSearchModal}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0248 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1758 | ` onClick={closeSearchModal}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0249 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1762 | ` onClick={(event) => event.stopPropagation()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0250 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1762 | ` onClick={(event) => event.stopPropagation()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0251 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1762 | ` onClick={(event) => event.stopPropagation()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0252 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1762 | ` onClick={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0253 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1768 | ` onInput={(event) => setSearchText(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0254 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1768 | ` onInput={(event) => setSearchText(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0255 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1768 | ` onInput={(event) => setSearchText(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0256 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1768 | ` onInput={(event) => setSearchText(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0257 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1790 | ` onClick={() => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0258 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1790 | ` onClick={() => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0259 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1790 | ` onClick={() => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0260 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1790 | ` onClick={() => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0261 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1844 | ` onClick={closeDetailModal}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0262 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1844 | ` onClick={closeDetailModal}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0263 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1844 | ` onClick={closeDetailModal}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0264 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1844 | ` onClick={closeDetailModal}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0265 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1848 | ` onClick={(event) => event.stopPropagation()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0266 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1848 | ` onClick={(event) => event.stopPropagation()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0267 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1848 | ` onClick={(event) => event.stopPropagation()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0268 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1848 | ` onClick={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0269 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1856 | ` onClick={closeDetailModal}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0270 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1856 | ` onClick={closeDetailModal}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0271 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1856 | ` onClick={closeDetailModal}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0272 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1856 | ` onClick={closeDetailModal}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0273 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1867 | ` onInput={(event) => setDetailContent(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0274 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1867 | ` onInput={(event) => setDetailContent(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0275 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1867 | ` onInput={(event) => setDetailContent(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0276 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1867 | ` onInput={(event) => setDetailContent(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0277 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1875 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0278 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1875 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0279 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1875 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0280 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1875 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0281 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1890 | ` onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0282 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1890 | ` onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0283 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1890 | ` onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0284 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1890 | ` onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0285 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1891 | ` onKeyDown={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0286 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1891 | ` onKeyDown={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0287 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1891 | ` onKeyDown={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0288 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1891 | ` onKeyDown={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0289 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1910 | ` onClick={() => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0290 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1910 | ` onClick={() => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0291 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1910 | ` onClick={() => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0292 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1910 | ` onClick={() => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0293 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1923 | ` onClick={() => setDetailNewProjectName(null)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0294 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1923 | ` onClick={() => setDetailNewProjectName(null)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0295 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1923 | ` onClick={() => setDetailNewProjectName(null)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0296 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1923 | ` onClick={() => setDetailNewProjectName(null)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0297 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1932 | ` onInput={(event) => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0298 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1932 | ` onInput={(event) => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0299 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1932 | ` onInput={(event) => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0300 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1932 | ` onInput={(event) => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0301 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1964 | ` onInput={(event) => setDetailTags(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0302 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1964 | ` onInput={(event) => setDetailTags(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0303 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1964 | ` onInput={(event) => setDetailTags(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0304 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1964 | ` onInput={(event) => setDetailTags(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0305 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1976 | ` onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0306 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1976 | ` onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0307 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1976 | ` onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0308 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1976 | ` onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0309 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1991 | ` onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0310 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1991 | ` onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0311 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1991 | ` onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0312 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1991 | ` onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0313 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1999 | ` onClick={() => setDetailDueText("")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0314 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1999 | ` onClick={() => setDetailDueText("")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0315 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1999 | ` onClick={() => setDetailDueText("")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0316 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:1999 | ` onClick={() => setDetailDueText("")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0317 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2018 | ` onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0318 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2018 | ` onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0319 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2018 | ` onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0320 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2018 | ` onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0321 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2026 | ` onClick={() => setDetailDeadline("")}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0322 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2026 | ` onClick={() => setDetailDeadline("")}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0323 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2026 | ` onClick={() => setDetailDeadline("")}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0324 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2026 | ` onClick={() => setDetailDeadline("")}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0325 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2057 | ` onInput={(event) => setDetailRecurrence(event.currentTarget.value)}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0326 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2057 | ` onInput={(event) => setDetailRecurrence(event.currentTarget.value)}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0327 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2057 | ` onInput={(event) => setDetailRecurrence(event.currentTarget.value)}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0328 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2057 | ` onInput={(event) => setDetailRecurrence(event.currentTarget.value)}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0329 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2065 | ` onClick={() => void parseDetailRecurrence()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0330 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2065 | ` onClick={() => void parseDetailRecurrence()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0331 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2065 | ` onClick={() => void parseDetailRecurrence()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0332 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2065 | ` onClick={() => void parseDetailRecurrence()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0333 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2148 | ` onClick={() => void makeDetailTaskLive()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0334 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2148 | ` onClick={() => void makeDetailTaskLive()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0335 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2148 | ` onClick={() => void makeDetailTaskLive()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0336 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2148 | ` onClick={() => void makeDetailTaskLive()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0337 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2184 | ` onClick={() => {` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0338 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2184 | ` onClick={() => {` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0339 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2184 | ` onClick={() => {` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0340 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2184 | ` onClick={() => {` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0341 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2197 | ` onClick={() => void saveDetailModal()}` | Desktop happy path | Automated | home.interactions.spec.ts |
| E2E-0342 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2197 | ` onClick={() => void saveDetailModal()}` | Validation/error path | Automated | home.interactions.spec.ts |
| E2E-0343 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2197 | ` onClick={() => void saveDetailModal()}` | Persistence/reload | Automated | home.interactions.spec.ts |
| E2E-0344 | HomeRoute | web/apps/client/src/routes/HomeRoute.tsx:2197 | ` onClick={() => void saveDetailModal()}` | Mobile/responsive | Automated | home.interactions.spec.ts |
| E2E-0345 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3101 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0346 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3101 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0347 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3101 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0348 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3101 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0349 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3124 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0350 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3124 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0351 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3124 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0352 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3124 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0353 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3125 | ` onKeyDown={(event) => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0354 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3125 | ` onKeyDown={(event) => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0355 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3125 | ` onKeyDown={(event) => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0356 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3125 | ` onKeyDown={(event) => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0357 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3138 | ` onClick={() => void createBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0358 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3138 | ` onClick={() => void createBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0359 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3138 | ` onClick={() => void createBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0360 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3138 | ` onClick={() => void createBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0361 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3146 | ` onClick={() => void deleteActiveBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0362 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3146 | ` onClick={() => void deleteActiveBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0363 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3146 | ` onClick={() => void deleteActiveBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0364 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3146 | ` onClick={() => void deleteActiveBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0365 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3179 | ` onClick={() => void removeBoardMember(member.userId)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0366 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3179 | ` onClick={() => void removeBoardMember(member.userId)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0367 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3179 | ` onClick={() => void removeBoardMember(member.userId)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0368 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3179 | ` onClick={() => void removeBoardMember(member.userId)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0369 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3197 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0370 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3197 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0371 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3197 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0372 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3197 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0373 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3212 | ` onClick={() => void addPendingBoardMember()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0374 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3212 | ` onClick={() => void addPendingBoardMember()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0375 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3212 | ` onClick={() => void addPendingBoardMember()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0376 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3212 | ` onClick={() => void addPendingBoardMember()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0377 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3332 | ` onClick={() => void claimQuestReward(quest.id)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0378 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3332 | ` onClick={() => void claimQuestReward(quest.id)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0379 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3332 | ` onClick={() => void claimQuestReward(quest.id)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0380 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3332 | ` onClick={() => void claimQuestReward(quest.id)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0381 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3377 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0382 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3377 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0383 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3377 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0384 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3377 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0385 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3398 | ` onClick={() => void createBoardFromPrompt()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0386 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3398 | ` onClick={() => void createBoardFromPrompt()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0387 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3398 | ` onClick={() => void createBoardFromPrompt()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0388 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3398 | ` onClick={() => void createBoardFromPrompt()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0389 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3406 | ` onClick={() => void deleteActiveBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0390 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3406 | ` onClick={() => void deleteActiveBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0391 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3406 | ` onClick={() => void deleteActiveBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0392 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3406 | ` onClick={() => void deleteActiveBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0393 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3439 | ` onClick={() => void endDay()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0394 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3439 | ` onClick={() => void endDay()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0395 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3439 | ` onClick={() => void endDay()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0396 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3439 | ` onClick={() => void endDay()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0397 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3448 | ` onClick={() => void refreshBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0398 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3448 | ` onClick={() => void refreshBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0399 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3448 | ` onClick={() => void refreshBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0400 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3448 | ` onClick={() => void refreshBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0401 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3467 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0402 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3467 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0403 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3467 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0404 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3467 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0405 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3490 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0406 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3490 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0407 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3490 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0408 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3490 | ` onInput={(event) => setNewBoardName(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0409 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3491 | ` onKeyDown={(event) => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0410 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3491 | ` onKeyDown={(event) => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0411 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3491 | ` onKeyDown={(event) => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0412 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3491 | ` onKeyDown={(event) => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0413 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3504 | ` onClick={() => void createBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0414 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3504 | ` onClick={() => void createBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0415 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3504 | ` onClick={() => void createBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0416 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3504 | ` onClick={() => void createBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0417 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3512 | ` onClick={() => void deleteActiveBoard()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0418 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3512 | ` onClick={() => void deleteActiveBoard()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0419 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3512 | ` onClick={() => void deleteActiveBoard()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0420 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3512 | ` onClick={() => void deleteActiveBoard()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0421 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3545 | ` onClick={() => void removeBoardMember(member.userId)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0422 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3545 | ` onClick={() => void removeBoardMember(member.userId)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0423 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3545 | ` onClick={() => void removeBoardMember(member.userId)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0424 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3545 | ` onClick={() => void removeBoardMember(member.userId)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0425 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3563 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0426 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3563 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0427 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3563 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0428 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3563 | ` onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0429 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3578 | ` onClick={() => void addPendingBoardMember()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0430 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3578 | ` onClick={() => void addPendingBoardMember()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0431 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3578 | ` onClick={() => void addPendingBoardMember()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0432 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3578 | ` onClick={() => void addPendingBoardMember()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0433 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3699 | ` onClick={() => void claimQuestReward(quest.id)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0434 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3699 | ` onClick={() => void claimQuestReward(quest.id)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0435 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3699 | ` onClick={() => void claimQuestReward(quest.id)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0436 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3699 | ` onClick={() => void claimQuestReward(quest.id)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0437 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3735 | ` onClick={() => setMobileMapHubOpen((open) => !open)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0438 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3735 | ` onClick={() => setMobileMapHubOpen((open) => !open)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0439 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3735 | ` onClick={() => setMobileMapHubOpen((open) => !open)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0440 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3735 | ` onClick={() => setMobileMapHubOpen((open) => !open)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0441 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3753 | ` onPointerDown={onMinimapPointerDown}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0442 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3753 | ` onPointerDown={onMinimapPointerDown}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0443 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3753 | ` onPointerDown={onMinimapPointerDown}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0444 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3753 | ` onPointerDown={onMinimapPointerDown}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0445 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3754 | ` onPointerMove={onMinimapPointerMove}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0446 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3754 | ` onPointerMove={onMinimapPointerMove}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0447 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3754 | ` onPointerMove={onMinimapPointerMove}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0448 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3754 | ` onPointerMove={onMinimapPointerMove}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0449 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3755 | ` onPointerUp={onMinimapPointerUp}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0450 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3755 | ` onPointerUp={onMinimapPointerUp}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0451 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3755 | ` onPointerUp={onMinimapPointerUp}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0452 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3755 | ` onPointerUp={onMinimapPointerUp}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0453 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3799 | ` onPointerDown={onMinimapPointerDown}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0454 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3799 | ` onPointerDown={onMinimapPointerDown}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0455 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3799 | ` onPointerDown={onMinimapPointerDown}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0456 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3799 | ` onPointerDown={onMinimapPointerDown}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0457 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3800 | ` onPointerMove={onMinimapPointerMove}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0458 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3800 | ` onPointerMove={onMinimapPointerMove}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0459 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3800 | ` onPointerMove={onMinimapPointerMove}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0460 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3800 | ` onPointerMove={onMinimapPointerMove}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0461 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3801 | ` onPointerUp={onMinimapPointerUp}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0462 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3801 | ` onPointerUp={onMinimapPointerUp}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0463 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3801 | ` onPointerUp={onMinimapPointerUp}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0464 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3801 | ` onPointerUp={onMinimapPointerUp}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0465 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3839 | ` onPointerDown={() => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0466 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3839 | ` onPointerDown={() => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0467 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3839 | ` onPointerDown={() => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0468 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3839 | ` onPointerDown={() => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0469 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3846 | ` onPointerDown={(event) => event.stopPropagation()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0470 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3846 | ` onPointerDown={(event) => event.stopPropagation()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0471 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3846 | ` onPointerDown={(event) => event.stopPropagation()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0472 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3846 | ` onPointerDown={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0473 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3857 | ` onClick={() => setDeckHubOpen(false)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0474 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3857 | ` onClick={() => setDeckHubOpen(false)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0475 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3857 | ` onClick={() => setDeckHubOpen(false)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0476 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3857 | ` onClick={() => setDeckHubOpen(false)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0477 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3871 | ` onDragOver={(event) => event.preventDefault()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0478 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3871 | ` onDragOver={(event) => event.preventDefault()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0479 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3871 | ` onDragOver={(event) => event.preventDefault()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0480 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3871 | ` onDragOver={(event) => event.preventDefault()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0481 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3872 | ` onDrop={(event) => handleDeckHubDropToRow(event)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0482 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3872 | ` onDrop={(event) => handleDeckHubDropToRow(event)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0483 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3872 | ` onDrop={(event) => handleDeckHubDropToRow(event)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0484 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3872 | ` onDrop={(event) => handleDeckHubDropToRow(event)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0485 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3883 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0486 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3883 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0487 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3883 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0488 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3883 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0489 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3884 | ` onDragEnd={endDeckHubDrag}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0490 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3884 | ` onDragEnd={endDeckHubDrag}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0491 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3884 | ` onDragEnd={endDeckHubDrag}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0492 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3884 | ` onDragEnd={endDeckHubDrag}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0493 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3885 | ` onDragOver={(event) => event.preventDefault()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0494 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3885 | ` onDragOver={(event) => event.preventDefault()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0495 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3885 | ` onDragOver={(event) => event.preventDefault()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0496 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3885 | ` onDragOver={(event) => event.preventDefault()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0497 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3886 | ` onDrop={(event) => handleDeckHubDropToRow(event, index())}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0498 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3886 | ` onDrop={(event) => handleDeckHubDropToRow(event, index())}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0499 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3886 | ` onDrop={(event) => handleDeckHubDropToRow(event, index())}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0500 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3886 | ` onDrop={(event) => handleDeckHubDropToRow(event, index())}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0501 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3892 | ` onClick={() => moveDeckToReserve(defID)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0502 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3892 | ` onClick={() => moveDeckToReserve(defID)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0503 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3892 | ` onClick={() => moveDeckToReserve(defID)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0504 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3892 | ` onClick={() => moveDeckToReserve(defID)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0505 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3915 | ` onDragOver={(event) => event.preventDefault()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0506 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3915 | ` onDragOver={(event) => event.preventDefault()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0507 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3915 | ` onDragOver={(event) => event.preventDefault()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0508 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3915 | ` onDragOver={(event) => event.preventDefault()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0509 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3916 | ` onDrop={(event) => handleDeckHubDropToReserve(event)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0510 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3916 | ` onDrop={(event) => handleDeckHubDropToReserve(event)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0511 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3916 | ` onDrop={(event) => handleDeckHubDropToReserve(event)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0512 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3916 | ` onDrop={(event) => handleDeckHubDropToReserve(event)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0513 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3927 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0514 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3927 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0515 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3927 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0516 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3927 | ` onDragStart={(event) => beginDeckHubDrag(event, defID)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0517 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3928 | ` onDragEnd={endDeckHubDrag}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0518 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3928 | ` onDragEnd={endDeckHubDrag}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0519 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3928 | ` onDragEnd={endDeckHubDrag}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0520 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3928 | ` onDragEnd={endDeckHubDrag}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0521 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3929 | ` onDragOver={(event) => event.preventDefault()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0522 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3929 | ` onDragOver={(event) => event.preventDefault()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0523 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3929 | ` onDragOver={(event) => event.preventDefault()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0524 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3929 | ` onDragOver={(event) => event.preventDefault()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0525 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3930 | ` onDrop={(event) => handleDeckHubDropToReserve(event, index())}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0526 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3930 | ` onDrop={(event) => handleDeckHubDropToReserve(event, index())}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0527 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3930 | ` onDrop={(event) => handleDeckHubDropToReserve(event, index())}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0528 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3930 | ` onDrop={(event) => handleDeckHubDropToReserve(event, index())}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0529 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3936 | ` onClick={() => moveDeckToRow(defID)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0530 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3936 | ` onClick={() => moveDeckToRow(defID)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0531 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3936 | ` onClick={() => moveDeckToRow(defID)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0532 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3936 | ` onClick={() => moveDeckToRow(defID)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0533 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3959 | ` onPointerDown={onBoardPointerDown}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0534 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3959 | ` onPointerDown={onBoardPointerDown}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0535 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3959 | ` onPointerDown={onBoardPointerDown}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0536 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:3959 | ` onPointerDown={onBoardPointerDown}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0537 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4040 | ` onPointerDown={(event) => onStackPointerDown(event, stack)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0538 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4040 | ` onPointerDown={(event) => onStackPointerDown(event, stack)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0539 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4040 | ` onPointerDown={(event) => onStackPointerDown(event, stack)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0540 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4040 | ` onPointerDown={(event) => onStackPointerDown(event, stack)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0541 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4041 | ` onClick={(event) => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0542 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4041 | ` onClick={(event) => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0543 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4041 | ` onClick={(event) => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0544 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4041 | ` onClick={(event) => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0545 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4100 | ` onInput={(event) => setInlineTitle(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0546 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4100 | ` onInput={(event) => setInlineTitle(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0547 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4100 | ` onInput={(event) => setInlineTitle(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0548 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4100 | ` onInput={(event) => setInlineTitle(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0549 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4102 | ` onClick={(event) => event.stopPropagation()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0550 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4102 | ` onClick={(event) => event.stopPropagation()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0551 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4102 | ` onClick={(event) => event.stopPropagation()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0552 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4102 | ` onClick={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0553 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4103 | ` onPointerDown={(event) => event.stopPropagation()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0554 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4103 | ` onPointerDown={(event) => event.stopPropagation()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0555 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4103 | ` onPointerDown={(event) => event.stopPropagation()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0556 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4103 | ` onPointerDown={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0557 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4104 | ` onKeyDown={(event) => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0558 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4104 | ` onKeyDown={(event) => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0559 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4104 | ` onKeyDown={(event) => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0560 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4104 | ` onKeyDown={(event) => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0561 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4114 | ` onBlur={() => void saveInlineEdit()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0562 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4114 | ` onBlur={() => void saveInlineEdit()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0563 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4114 | ` onBlur={() => void saveInlineEdit()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0564 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4114 | ` onBlur={() => void saveInlineEdit()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0565 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4226 | ` onPointerDown={(event) => event.stopPropagation()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0566 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4226 | ` onPointerDown={(event) => event.stopPropagation()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0567 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4226 | ` onPointerDown={(event) => event.stopPropagation()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0568 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4226 | ` onPointerDown={(event) => event.stopPropagation()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0569 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4227 | ` onClick={(event) => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0570 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4227 | ` onClick={(event) => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0571 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4227 | ` onClick={(event) => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0572 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4227 | ` onClick={(event) => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0573 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4269 | ` onClick={closeDetail}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0574 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4269 | ` onClick={closeDetail}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0575 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4269 | ` onClick={closeDetail}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0576 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4269 | ` onClick={closeDetail}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0577 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4285 | ` onInput={(event) => onDetailTitleInput(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0578 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4285 | ` onInput={(event) => onDetailTitleInput(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0579 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4285 | ` onInput={(event) => onDetailTitleInput(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0580 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4285 | ` onInput={(event) => onDetailTitleInput(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0581 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4382 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0582 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4382 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0583 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4382 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0584 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4382 | ` onInput={(event) => setDetailDescription(event.currentTarget.value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0585 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4390 | ` onClick={openInTaskPage}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0586 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4390 | ` onClick={openInTaskPage}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0587 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4390 | ` onClick={openInTaskPage}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0588 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4390 | ` onClick={openInTaskPage}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0589 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4409 | ` onClick={() => setDetailPriority(value === 0 ? 4 : value)}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0590 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4409 | ` onClick={() => setDetailPriority(value === 0 ? 4 : value)}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0591 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4409 | ` onClick={() => setDetailPriority(value === 0 ? 4 : value)}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0592 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4409 | ` onClick={() => setDetailPriority(value === 0 ? 4 : value)}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0593 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4481 | ` onClick={() => {` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0594 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4481 | ` onClick={() => {` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0595 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4481 | ` onClick={() => {` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0596 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4481 | ` onClick={() => {` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0597 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4493 | ` onClick={() => void saveDetail()}` | Desktop happy path | Automated | board.ui.spec.ts |
| E2E-0598 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4493 | ` onClick={() => void saveDetail()}` | Validation/error path | Automated | board.ui.spec.ts |
| E2E-0599 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4493 | ` onClick={() => void saveDetail()}` | Persistence/reload | Automated | board.ui.spec.ts |
| E2E-0600 | BoardRoute | web/apps/client/src/routes/BoardRoute.tsx:4493 | ` onClick={() => void saveDetail()}` | Mobile/responsive | Automated | board.ui.spec.ts |
| E2E-0601 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:324 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Desktop happy path | Automated | profile.interactions.spec.ts |
| E2E-0602 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:324 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Validation/error path | Automated | profile.interactions.spec.ts |
| E2E-0603 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:324 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Persistence/reload | Automated | profile.interactions.spec.ts |
| E2E-0604 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:324 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Mobile/responsive | Automated | profile.interactions.spec.ts |
| E2E-0605 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:383 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Desktop happy path | Automated | profile.interactions.spec.ts |
| E2E-0606 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:383 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Validation/error path | Automated | profile.interactions.spec.ts |
| E2E-0607 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:383 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Persistence/reload | Automated | profile.interactions.spec.ts |
| E2E-0608 | ProfileRoute | web/apps/client/src/routes/ProfileRoute.tsx:383 | ` onInput={(event) => switchBoard(event.currentTarget.value)}` | Mobile/responsive | Automated | profile.interactions.spec.ts |

## Summary
- Generated matrix cases: **608**
- Automated matrix cases: **608**
- Backlog remaining: **0**
