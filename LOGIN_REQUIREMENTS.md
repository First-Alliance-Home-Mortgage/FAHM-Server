# Login Screen Requirements

## Scope
- Screen: /(auth)/login
- Purpose: Authenticate users via email/password with demo role selection, and provide quick enterprise/biometric sign-in stubs.
- Owners: Auth experience, demo persona switching, credential persistence preferences.

## User Stories
- As a user, I can sign in with email/password so I can access the app.
- As a demo user, I can switch personas to preview different dashboards without server-side role binding.
- As a returning user, I can remember my email on this device to speed up next login.
- As an enterprise user, I can choose an SSO path (Azure AD stub) instead of typing credentials.
- As a mobile user, I can use device biometrics when available for quick sign-in.
- As any user, I get clear validation, loading feedback, and error toasts when input is invalid or auth fails.

## Functional Requirements
- Email/password form
  - Email must be a valid format; password must be non-empty to enable "Sign In".
  - On submit, show loading indicator; navigate to /(app)/(drawer)/(tabs) on success.
  - Invalid email or empty password triggers a toast with guidance.
- Role selection (demo-only)
  - Role list: borrower, loan_officer_tpo, loan_officer_retail, broker, branch_manager, realtor, admin.
  - Modal presents roles with labels/descriptions; selecting a role updates the current persona and closes the modal.
  - Selected role is passed to AuthContext via signIn.
- Remember my ID
  - Toggle persisted in AsyncStorage under fahm:remember_me; remembered email under fahm:last_email.
  - When enabled, store trimmed email on change; when disabled, clear stored email.
- Quick auth actions (stubs)
  - Azure AD button simulates SSO; uses current/remembered email or azure.user@fahm.ai fallback; reuses signIn pipeline.
  - Biometric button uses expo-local-authentication; on success, signs in with current/remembered email or faceid.user@fahm.ai fallback.
- Forgot password
  - Requires valid email; otherwise toast prompts to add email.
- Navigation
  - Success path: router.replace('/(app)/(drawer)/(tabs)').
  - Register link (existing screen) should continue to push /(auth)/profile-setup.

## Non-Functional Requirements
- Accessibility: inputs/buttons expose accessibilityLabel; modal closes via backdrop tap and close icon; keyboard-aware scrolling maintains focus.
- Theming: All colors sourced from NavTheme; no hard-coded hex; respects dark/light mode.
- Performance: Auth simulations use short timeouts (~600ms); avoid blocking UI thread.
- Security: Do not store passwords; only persist email when user opted in; avoid hard-coding real credentials.
- Offline: Form interaction and validation should not crash when AsyncStorage fails; fail silently on storage errors.

## Data Persistence
- fahm:remember_me ("true"/"false")
- fahm:last_email (string email)

## Error Handling & Messaging
- Invalid email → toast: "Enter a valid email to continue."
- Missing password → toast: "Enter your password to continue."
- Biometric unavailable → toast instructs enabling biometrics.
- Biometric failure (non-cancel) → toast: "Biometric authentication failed. Try again."
- Forgot password without email → toast: "Add your email to receive a reset link."

## States & Defaults
- email: "alex.morgan@example.com"
- password: "" (empty)
- role: borrower
- rememberMe: false (loads from storage)
- rememberedEmail: null (populated if stored)
- isLoading / isAzureLoading / isFaceIdLoading: false
- isBiometricAvailable: derived from hardware/enrollment
- isRoleModalVisible: false

## Acceptance Criteria
- Sign-in button disabled until email valid + password non-empty; shows spinner while loading.
- Toggling remember on stores email; toggling off clears stored email; reopening app pre-fills when remember was enabled.
- Selecting a role updates the summary and is used in signIn payload.
- Azure and biometric buttons reuse signIn and navigate to the main app on success.
- Biometric button disabled when hardware/enrollment unavailable; note text displayed in that case.
- Forgot password flow requires valid email and surfaces a toast.

## Open Integration Hooks (future work)
- Replace simulated email/password auth with backend API call and error handling.
- Wire Azure AD button to real SSO (OAuth2/OpenID Connect) and propagate returned role/claims.
- Extend signIn to persist authenticated session tokens and refresh flows.
- Add analytics events for sign-in attempts, failures, role switches, and remember-me toggles.
- Introduce rate limiting/lockout handling for repeated failures once backend exists.
