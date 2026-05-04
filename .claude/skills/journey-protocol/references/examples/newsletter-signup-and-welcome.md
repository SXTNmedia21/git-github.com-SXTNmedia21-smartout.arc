# Example: newsletter-signup-and-welcome.journey.yaml

> Reference example. Use as a model when generating new IRs.

```yaml
schema_version: "2.0.0"
journey_version: "v1"
id: "newsletter-signup-and-welcome"
title: "Newsletter signup + welcome"
description: "Anonymous visitor signs up, receives confirmation email, returns to run a search, and is welcomed by name."

mode: "sequential"
repeat_policy: "first_time_only"

actor: "anonymous_visitor"
platform: "web"
auth_profile: "anonymous"

module: "onboarding"
relevance:
  onboarding: true
  daily_use: false
  rare_event: false
priority: "P0"

entry_url: "https://example.com/landing"
preconditions:
  - "Email provider configured"
  - "Search index has at least 100 documents"

success_gate:
  description: "User has clicked the confirmation link AND completed at least one search"
  predicate: "events.contains('step.email.confirmation_clicked') AND events.contains('step.search.completed')"

prerequisites: []
terminates: []
exclusive_with: []

assist:
  threshold: 0.85
  default_silence_ms: 15000
  cooldown_ms: 3600000

tags: ["onboarding", "newsletter", "core"]

system_prompt: |
  You are a friendly assistant helping a first-time visitor subscribe to the newsletter.
  Tone: warm, brief, never pushy. Always offer to skip if user seems hesitant.

i18n:
  en:
    title: "Newsletter signup + welcome"
    description: "Subscribe and get welcomed back."
  no:
    title: "Nyhetsbrev-påmelding og velkomst"
    description: "Meld deg på og bli ønsket velkommen tilbake."

steps:
  - key: "step.scroll.50"
    title: "Scroll past hero"
    description: "Visitor scrolls past the top hero section"
    order: 1
    trigger:
      type: "dom_event"
      event: "viewport_intersect"
      selector: "[data-journey='hero-bottom']"
    assertion: "viewport.intersects(selector)"
    next_step_window_ms: 60000
    on_timeout: "background"
    reentry_trigger: "scroll_or_form_focus"
    weight: 0.1
    confidence_contribution: "low"
    actor: "anonymous_visitor"
    pii_input: false
    instructions: ""

  - key: "step.form.email_filled"
    title: "Type email"
    description: "Visitor types a valid email into newsletter input"
    order: 2
    trigger:
      type: "dom_event"
      event: "input"
      selector: "input[name='email'][data-journey='newsletter']"
    assertion: "input.value.matches('^[^@]+@[^@]+\\.[^@]+$')"
    next_step_window_ms: 30000
    on_timeout: "assist"
    assist_silence_ms: 15000
    weight: 0.25
    confidence_contribution: "medium"
    actor: "anonymous_visitor"
    pii_input: false
    instructions: "Encourage user to complete the form. Mention that confirmation is one-click."

  - key: "step.form.name_filled"
    title: "Type name"
    description: "Visitor types name"
    order: 3
    trigger:
      type: "dom_event"
      event: "input"
      selector: "input[name='name'][data-journey='newsletter']"
    assertion: "input.value.length > 0"
    next_step_window_ms: 15000
    on_timeout: "assist"
    weight: 0.15
    confidence_contribution: "medium"
    actor: "anonymous_visitor"
    pii_input: false

  - key: "step.form.submitted"
    title: "Submit form"
    description: "Visitor clicks Get newsletter button"
    order: 4
    trigger:
      type: "dom_event"
      event: "click"
      selector: "button[data-journey='subscribe-submit']"
    assertion: "events.recent.contains('step.api.subscribe_ok')"
    next_step_window_ms: 5000
    on_timeout: "abandon"
    weight: 0.2
    confidence_contribution: "high"
    actor: "anonymous_visitor"
    pii_input: false

  - key: "step.api.subscribe_ok"
    title: "Subscribe API succeeds"
    description: "Backend processes signup successfully"
    order: 5
    trigger:
      type: "network_response"
      method: "POST"
      path: "/api/subscribe"
      status: 200
    assertion: "response.body.success === true"
    next_step_window_ms: 10000
    on_timeout: "pause"
    weight: 0.1
    confidence_contribution: "high"
    actor: "anonymous_visitor"
    pii_input: false

  - key: "step.email.confirmation_sent"
    title: "Confirmation email sent"
    description: "Email service queues confirmation email"
    order: 6
    trigger:
      type: "server_event"
      event_name: "email.queued"
      filter: "template_id == 'newsletter_confirmation'"
    assertion: "true"
    next_step_window_ms: 86400000
    on_timeout: "background"
    reentry_trigger: "magic_link_click"
    weight: 0.05
    confidence_contribution: "medium"
    actor: "system"
    pii_input: false

  - key: "step.email.confirmation_clicked"
    title: "Magic link clicked"
    description: "User clicks confirmation link in email (possibly different device, possibly later)"
    order: 7
    trigger:
      type: "network_response"
      method: "GET"
      path: "/welcome"
      status: 302
    assertion: "request.query.token IS valid AND not expired"
    next_step_window_ms: 60000
    on_timeout: "abandon"
    weight: 0.1
    confidence_contribution: "high"
    actor: "anonymous_visitor"
    pii_input: false

  - key: "step.search.completed"
    title: "User completes a search"
    description: "User runs a search query and sees results"
    order: 8
    trigger:
      type: "dom_event"
      event: "submit"
      selector: "form[data-journey='search']"
    assertion: "events.recent.contains('search.results_rendered')"
    next_step_window_ms: 30000
    on_timeout: "background"
    reentry_trigger: "search_form_submit"
    weight: 0.05
    confidence_contribution: "terminal"
    actor: "anonymous_visitor"
    pii_input: false
    instructions: "Suggest a topic that aligns with the user's signup interest, if known."
```