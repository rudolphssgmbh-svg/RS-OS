#!/usr/bin/env bash
set -euo pipefail
umask 077

export LC_ALL=C

cd "$(git rev-parse --show-toplevel)"

OUTPUT_PATH="runtime-api/migrations/108_runtime_process_foundation.sql"
TEMP_PATH="${OUTPUT_PATH}.tmp.$$"

cleanup() {
  rm -f "$TEMP_PATH"
}

trap cleanup EXIT INT TERM

cat > "$TEMP_PATH" <<'SQL'
-- RSOS Migration 108
-- Runtime Process Foundation
--
-- Scope:
--   * process definitions and immutable versions
--   * process steps and transitions
--   * process and step instances
--   * assignments, evidence, approvals, deadlines and escalations
--   * append-only command journal
--
-- Explicit exclusions:
--   * no seed data
--   * no runtime routes
--   * no worker integration
--   * no runtime_workflow_instances changes
--   * no transaction-control statements
--
-- Transaction ownership belongs to the RSOS migration runner.

-- BEGIN MODULE: 010_process_definitions.sql
-- Module: 010_process_definitions.sql

CREATE TABLE public.runtime_process_definitions (
  process_definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_key TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version_id UUID,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

-- END MODULE: 010_process_definitions.sql

-- BEGIN MODULE: 020_process_versions.sql
-- Module: 020_process_versions.sql

CREATE TABLE public.runtime_process_versions (
  process_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_definition_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  previous_version_id UUID,
  version_status TEXT NOT NULL DEFAULT 'draft',
  schema_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by TEXT,
  published_at TIMESTAMPTZ
);

-- END MODULE: 020_process_versions.sql

-- BEGIN MODULE: 030_process_steps.sql
-- Module: 030_process_steps.sql

CREATE TABLE public.runtime_process_steps (
  process_step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_version_id UUID NOT NULL,
  step_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  step_type TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  required_role TEXT,
  completion_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  governance_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeout_seconds INTEGER,
  is_initial BOOLEAN NOT NULL DEFAULT false,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- END MODULE: 030_process_steps.sql

-- BEGIN MODULE: 040_process_transitions.sql
-- Module: 040_process_transitions.sql

CREATE TABLE public.runtime_process_transitions (
  process_transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_version_id UUID NOT NULL,
  source_step_id UUID NOT NULL,
  target_step_id UUID NOT NULL,
  transition_key TEXT NOT NULL,
  condition_expression JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  requires_governance BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- END MODULE: 040_process_transitions.sql

-- BEGIN MODULE: 050_process_instances.sql
-- Module: 050_process_instances.sql

CREATE TABLE public.runtime_process_instances (
  process_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_version_id UUID NOT NULL,
  object_id TEXT NOT NULL,
  trace_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  current_step_id UUID,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- END MODULE: 050_process_instances.sql

-- BEGIN MODULE: 060_process_step_instances.sql
-- Module: 060_process_step_instances.sql

CREATE TABLE public.runtime_process_step_instances (
  process_step_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID NOT NULL,
  process_step_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- END MODULE: 060_process_step_instances.sql

-- BEGIN MODULE: 070_process_assignments.sql
-- Module: 070_process_assignments.sql

CREATE TABLE public.runtime_process_assignments (
  process_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_step_instance_id UUID NOT NULL,
  assignment_type TEXT NOT NULL,
  assignee_id TEXT,
  assigned_role TEXT,
  assignment_status TEXT NOT NULL DEFAULT 'assigned',
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 070_process_assignments.sql

-- BEGIN MODULE: 080_process_evidence_links.sql
-- Module: 080_process_evidence_links.sql

CREATE TABLE public.runtime_process_evidence_links (
  process_evidence_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID NOT NULL,
  process_step_instance_id UUID,
  evidence_id UUID NOT NULL,
  link_type TEXT NOT NULL,
  linked_by TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 080_process_evidence_links.sql

-- BEGIN MODULE: 090_process_approval_requests.sql
-- Module: 090_process_approval_requests.sql

CREATE TABLE public.runtime_process_approval_requests (
  process_approval_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID NOT NULL,
  process_step_instance_id UUID,
  object_id TEXT NOT NULL,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  governance_decision_id TEXT,
  decided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 090_process_approval_requests.sql

-- BEGIN MODULE: 100_process_deadlines.sql
-- Module: 100_process_deadlines.sql

CREATE TABLE public.runtime_process_deadlines (
  process_deadline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID NOT NULL,
  process_step_instance_id UUID,
  deadline_type TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  satisfied_at TIMESTAMPTZ,
  breached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 100_process_deadlines.sql

-- BEGIN MODULE: 110_process_escalations.sql
-- Module: 110_process_escalations.sql

CREATE TABLE public.runtime_process_escalations (
  process_escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID NOT NULL,
  process_step_instance_id UUID,
  process_deadline_id UUID,
  escalation_level INTEGER NOT NULL DEFAULT 1,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  escalated_to TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- END MODULE: 110_process_escalations.sql

-- BEGIN MODULE: 120_process_commands.sql
-- Module: 120_process_commands.sql

CREATE TABLE public.runtime_process_commands (
  process_command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  process_instance_id UUID,
  process_step_instance_id UUID,
  command_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  expected_status TEXT,
  command_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT NOT NULL,
  actor_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- END MODULE: 120_process_commands.sql

-- BEGIN MODULE: 200_constraints.sql
-- Module: 200_constraints.sql

ALTER TABLE public.runtime_process_definitions
  ADD CONSTRAINT runtime_process_definitions_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES public.runtime_tenants (tenant_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_definitions_scope_key
    UNIQUE (tenant_id, process_definition_id),
  ADD CONSTRAINT runtime_process_definitions_process_key
    UNIQUE (tenant_id, process_key),
  ADD CONSTRAINT runtime_process_definitions_identity_check
    CHECK (
      length(btrim(tenant_id)) > 0
      AND length(btrim(process_key)) > 0
      AND length(btrim(name)) > 0
      AND length(btrim(domain)) > 0
      AND length(btrim(created_by)) > 0
    ),
  ADD CONSTRAINT runtime_process_definitions_status_check
    CHECK (status IN ('draft', 'active', 'retired'));

ALTER TABLE public.runtime_process_versions
  ADD CONSTRAINT runtime_process_versions_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES public.runtime_tenants (tenant_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_versions_definition_scope_fk
    FOREIGN KEY (tenant_id, process_definition_id)
    REFERENCES public.runtime_process_definitions (
      tenant_id,
      process_definition_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_versions_scope_key
    UNIQUE (tenant_id, process_version_id),
  ADD CONSTRAINT runtime_process_versions_number_key
    UNIQUE (
      tenant_id,
      process_definition_id,
      version_number
    ),
  ADD CONSTRAINT runtime_process_versions_previous_key
    UNIQUE (previous_version_id),
  ADD CONSTRAINT runtime_process_versions_number_check
    CHECK (version_number >= 1),
  ADD CONSTRAINT runtime_process_versions_status_check
    CHECK (version_status IN ('draft', 'published', 'retired')),
  ADD CONSTRAINT runtime_process_versions_predecessor_check
    CHECK (
      (
        version_number = 1
        AND previous_version_id IS NULL
      )
      OR
      (
        version_number > 1
        AND previous_version_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT runtime_process_versions_publication_check
    CHECK (
      (
        version_status = 'published'
        AND schema_hash IS NOT NULL
        AND length(btrim(schema_hash)) > 0
        AND published_by IS NOT NULL
        AND length(btrim(published_by)) > 0
        AND published_at IS NOT NULL
      )
      OR version_status <> 'published'
    ),
  ADD CONSTRAINT runtime_process_versions_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_versions
  ADD CONSTRAINT runtime_process_versions_previous_scope_fk
    FOREIGN KEY (tenant_id, previous_version_id)
    REFERENCES public.runtime_process_versions (
      tenant_id,
      process_version_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_process_definitions
  ADD CONSTRAINT runtime_process_definitions_current_version_scope_fk
    FOREIGN KEY (tenant_id, current_version_id)
    REFERENCES public.runtime_process_versions (
      tenant_id,
      process_version_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

ALTER TABLE public.runtime_process_steps
  ADD CONSTRAINT runtime_process_steps_version_scope_fk
    FOREIGN KEY (tenant_id, process_version_id)
    REFERENCES public.runtime_process_versions (
      tenant_id,
      process_version_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_steps_scope_key
    UNIQUE (tenant_id, process_step_id),
  ADD CONSTRAINT runtime_process_steps_version_step_key
    UNIQUE (tenant_id, process_version_id, step_key),
  ADD CONSTRAINT runtime_process_steps_sequence_key
    UNIQUE (tenant_id, process_version_id, sequence_number),
  ADD CONSTRAINT runtime_process_steps_sequence_check
    CHECK (sequence_number >= 1),
  ADD CONSTRAINT runtime_process_steps_timeout_check
    CHECK (timeout_seconds IS NULL OR timeout_seconds > 0),
  ADD CONSTRAINT runtime_process_steps_type_check
    CHECK (
      step_type IN (
        'manual_task',
        'inspection',
        'diagnosis',
        'measurement',
        'approval',
        'decision',
        'document',
        'communication',
        'automation',
        'wait',
        'quality_gate',
        'completion'
      )
    ),
  ADD CONSTRAINT runtime_process_steps_json_check
    CHECK (
      jsonb_typeof(completion_policy) = 'object'
      AND jsonb_typeof(evidence_policy) = 'object'
      AND jsonb_typeof(governance_policy) = 'object'
      AND jsonb_typeof(metadata) = 'object'
    );

ALTER TABLE public.runtime_process_transitions
  ADD CONSTRAINT runtime_process_transitions_version_scope_fk
    FOREIGN KEY (tenant_id, process_version_id)
    REFERENCES public.runtime_process_versions (
      tenant_id,
      process_version_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_transitions_source_scope_fk
    FOREIGN KEY (tenant_id, source_step_id)
    REFERENCES public.runtime_process_steps (
      tenant_id,
      process_step_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_transitions_target_scope_fk
    FOREIGN KEY (tenant_id, target_step_id)
    REFERENCES public.runtime_process_steps (
      tenant_id,
      process_step_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_transitions_scope_key
    UNIQUE (tenant_id, process_transition_id),
  ADD CONSTRAINT runtime_process_transitions_key
    UNIQUE (tenant_id, process_version_id, transition_key),
  ADD CONSTRAINT runtime_process_transitions_self_check
    CHECK (source_step_id <> target_step_id),
  ADD CONSTRAINT runtime_process_transitions_priority_check
    CHECK (priority >= 0),
  ADD CONSTRAINT runtime_process_transitions_json_check
    CHECK (
      jsonb_typeof(condition_expression) = 'object'
      AND jsonb_typeof(metadata) = 'object'
    );

ALTER TABLE public.runtime_process_instances
  ADD CONSTRAINT runtime_process_instances_version_scope_fk
    FOREIGN KEY (tenant_id, process_version_id)
    REFERENCES public.runtime_process_versions (
      tenant_id,
      process_version_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_instances_current_step_scope_fk
    FOREIGN KEY (tenant_id, current_step_id)
    REFERENCES public.runtime_process_steps (
      tenant_id,
      process_step_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_instances_scope_key
    UNIQUE (tenant_id, process_instance_id),
  ADD CONSTRAINT runtime_process_instances_status_check
    CHECK (
      status IN (
        'created',
        'ready',
        'running',
        'waiting',
        'blocked',
        'review_required',
        'completed',
        'cancelled',
        'failed'
      )
    ),
  ADD CONSTRAINT runtime_process_instances_identity_check
    CHECK (
      length(btrim(tenant_id)) > 0
      AND length(btrim(object_id)) > 0
      AND length(btrim(started_by)) > 0
    ),
  ADD CONSTRAINT runtime_process_instances_context_check
    CHECK (jsonb_typeof(context) = 'object'),
  ADD CONSTRAINT runtime_process_instances_terminal_time_check
    CHECK (
      (
        status = 'completed'
        AND completed_at IS NOT NULL
        AND cancelled_at IS NULL
      )
      OR
      (
        status = 'cancelled'
        AND cancelled_at IS NOT NULL
        AND completed_at IS NULL
      )
      OR
      (
        status = 'failed'
        AND completed_at IS NULL
        AND cancelled_at IS NULL
      )
      OR status NOT IN ('completed', 'cancelled', 'failed')
    );

ALTER TABLE public.runtime_process_step_instances
  ADD CONSTRAINT runtime_process_step_instances_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_step_instances_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_id)
    REFERENCES public.runtime_process_steps (
      tenant_id,
      process_step_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_step_instances_scope_key
    UNIQUE (tenant_id, process_step_instance_id),
  ADD CONSTRAINT runtime_process_step_instances_attempt_key
    UNIQUE (
      tenant_id,
      process_instance_id,
      process_step_id,
      attempt_number
    ),
  ADD CONSTRAINT runtime_process_step_instances_attempt_check
    CHECK (attempt_number >= 1),
  ADD CONSTRAINT runtime_process_step_instances_status_check
    CHECK (
      status IN (
        'pending',
        'ready',
        'assigned',
        'running',
        'waiting',
        'submitted',
        'verified',
        'completed',
        'rejected',
        'skipped',
        'failed'
      )
    ),
  ADD CONSTRAINT runtime_process_step_instances_json_check
    CHECK (
      jsonb_typeof(input_context) = 'object'
      AND jsonb_typeof(output_context) = 'object'
    );

ALTER TABLE public.runtime_process_assignments
  ADD CONSTRAINT runtime_process_assignments_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_assignments_scope_key
    UNIQUE (tenant_id, process_assignment_id),
  ADD CONSTRAINT runtime_process_assignments_type_check
    CHECK (
      assignment_type IN (
        'user',
        'role',
        'team',
        'workstation',
        'equipment',
        'automatic'
      )
    ),
  ADD CONSTRAINT runtime_process_assignments_status_check
    CHECK (
      assignment_status IN (
        'assigned',
        'accepted',
        'released',
        'revoked',
        'completed'
      )
    ),
  ADD CONSTRAINT runtime_process_assignments_target_check
    CHECK (
      assignee_id IS NOT NULL
      OR assigned_role IS NOT NULL
      OR assignment_type = 'automatic'
    ),
  ADD CONSTRAINT runtime_process_assignments_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_evidence_links
  ADD CONSTRAINT runtime_process_evidence_links_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_evidence_links_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_evidence_links_evidence_fk
    FOREIGN KEY (evidence_id)
    REFERENCES public.runtime_evidence (evidence_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_evidence_links_scope_key
    UNIQUE (tenant_id, process_evidence_link_id),
  ADD CONSTRAINT runtime_process_evidence_links_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_approval_requests
  ADD CONSTRAINT runtime_process_approval_requests_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_approval_requests_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_approval_requests_governance_scope_fk
    FOREIGN KEY (
      governance_decision_id,
      object_id,
      tenant_id
    )
    REFERENCES public.runtime_governance_decisions (
      decision_id,
      object_id,
      tenant_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_approval_requests_scope_key
    UNIQUE (tenant_id, process_approval_request_id),
  ADD CONSTRAINT runtime_process_approval_requests_status_check
    CHECK (
      status IN (
        'requested',
        'review_required',
        'approved',
        'rejected',
        'cancelled'
      )
    ),
  ADD CONSTRAINT runtime_process_approval_requests_decision_check
    CHECK (
      (
        status IN ('approved', 'rejected')
        AND governance_decision_id IS NOT NULL
        AND decided_at IS NOT NULL
      )
      OR status NOT IN ('approved', 'rejected')
    ),
  ADD CONSTRAINT runtime_process_approval_requests_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_deadlines
  ADD CONSTRAINT runtime_process_deadlines_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_deadlines_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_deadlines_scope_key
    UNIQUE (tenant_id, process_deadline_id),
  ADD CONSTRAINT runtime_process_deadlines_status_check
    CHECK (
      status IN (
        'pending',
        'satisfied',
        'breached',
        'cancelled'
      )
    ),
  ADD CONSTRAINT runtime_process_deadlines_time_check
    CHECK (
      (
        status = 'satisfied'
        AND satisfied_at IS NOT NULL
        AND breached_at IS NULL
      )
      OR
      (
        status = 'breached'
        AND breached_at IS NOT NULL
        AND satisfied_at IS NULL
      )
      OR
      (
        status IN ('pending', 'cancelled')
        AND satisfied_at IS NULL
        AND breached_at IS NULL
      )
    ),
  ADD CONSTRAINT runtime_process_deadlines_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_escalations
  ADD CONSTRAINT runtime_process_escalations_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_escalations_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_escalations_deadline_scope_fk
    FOREIGN KEY (tenant_id, process_deadline_id)
    REFERENCES public.runtime_process_deadlines (
      tenant_id,
      process_deadline_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_escalations_scope_key
    UNIQUE (tenant_id, process_escalation_id),
  ADD CONSTRAINT runtime_process_escalations_level_check
    CHECK (escalation_level >= 1),
  ADD CONSTRAINT runtime_process_escalations_status_check
    CHECK (
      status IN (
        'open',
        'acknowledged',
        'resolved',
        'cancelled'
      )
    ),
  ADD CONSTRAINT runtime_process_escalations_resolution_check
    CHECK (
      (
        status = 'resolved'
        AND resolved_by IS NOT NULL
        AND resolved_at IS NOT NULL
      )
      OR status <> 'resolved'
    ),
  ADD CONSTRAINT runtime_process_escalations_metadata_check
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.runtime_process_commands
  ADD CONSTRAINT runtime_process_commands_instance_scope_fk
    FOREIGN KEY (tenant_id, process_instance_id)
    REFERENCES public.runtime_process_instances (
      tenant_id,
      process_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_commands_step_scope_fk
    FOREIGN KEY (tenant_id, process_step_instance_id)
    REFERENCES public.runtime_process_step_instances (
      tenant_id,
      process_step_instance_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT runtime_process_commands_scope_key
    UNIQUE (tenant_id, process_command_id),
  ADD CONSTRAINT runtime_process_commands_idempotency_key
    UNIQUE (tenant_id, idempotency_key),
  ADD CONSTRAINT runtime_process_commands_identity_check
    CHECK (
      length(btrim(tenant_id)) > 0
      AND length(btrim(command_type)) > 0
      AND length(btrim(idempotency_key)) > 0
      AND length(btrim(actor_id)) > 0
    ),
  ADD CONSTRAINT runtime_process_commands_payload_check
    CHECK (jsonb_typeof(command_payload) = 'object');

-- END MODULE: 200_constraints.sql

-- BEGIN MODULE: 210_indexes.sql
-- Module: 210_indexes.sql

CREATE INDEX idx_runtime_process_definitions_tenant_status
ON public.runtime_process_definitions (tenant_id, status);

CREATE INDEX idx_runtime_process_versions_definition_status
ON public.runtime_process_versions (
  tenant_id,
  process_definition_id,
  version_status,
  version_number DESC
);

CREATE INDEX idx_runtime_process_steps_version_sequence
ON public.runtime_process_steps (
  tenant_id,
  process_version_id,
  sequence_number
);

CREATE UNIQUE INDEX idx_runtime_process_steps_single_initial
ON public.runtime_process_steps (
  tenant_id,
  process_version_id
)
WHERE is_initial = true;

CREATE INDEX idx_runtime_process_transitions_source
ON public.runtime_process_transitions (
  tenant_id,
  process_version_id,
  source_step_id,
  priority
);

CREATE INDEX idx_runtime_process_instances_tenant_status
ON public.runtime_process_instances (
  tenant_id,
  status,
  updated_at DESC
);

CREATE INDEX idx_runtime_process_instances_object
ON public.runtime_process_instances (
  tenant_id,
  object_id,
  created_at DESC
);

CREATE INDEX idx_runtime_process_step_instances_instance_status
ON public.runtime_process_step_instances (
  tenant_id,
  process_instance_id,
  status,
  created_at
);

CREATE INDEX idx_runtime_process_assignments_status
ON public.runtime_process_assignments (
  tenant_id,
  assignment_status,
  assigned_at
);

CREATE INDEX idx_runtime_process_evidence_links_instance
ON public.runtime_process_evidence_links (
  tenant_id,
  process_instance_id,
  linked_at
);

CREATE INDEX idx_runtime_process_evidence_links_evidence
ON public.runtime_process_evidence_links (
  evidence_id
);

CREATE UNIQUE INDEX idx_runtime_process_evidence_links_step_unique
ON public.runtime_process_evidence_links (
  tenant_id,
  process_instance_id,
  process_step_instance_id,
  evidence_id,
  link_type
)
WHERE process_step_instance_id IS NOT NULL;

CREATE UNIQUE INDEX idx_runtime_process_evidence_links_instance_unique
ON public.runtime_process_evidence_links (
  tenant_id,
  process_instance_id,
  evidence_id,
  link_type
)
WHERE process_step_instance_id IS NULL;

CREATE INDEX idx_runtime_process_approval_requests_status
ON public.runtime_process_approval_requests (
  tenant_id,
  status,
  requested_at
);

CREATE INDEX idx_runtime_process_deadlines_due
ON public.runtime_process_deadlines (
  tenant_id,
  status,
  due_at
);

CREATE INDEX idx_runtime_process_escalations_status
ON public.runtime_process_escalations (
  tenant_id,
  status,
  escalation_level,
  created_at
);

CREATE INDEX idx_runtime_process_commands_instance
ON public.runtime_process_commands (
  tenant_id,
  process_instance_id,
  created_at
);

-- END MODULE: 210_indexes.sql

-- BEGIN MODULE: 220_tenant_scope_guards.sql
-- Module: 220_tenant_scope_guards.sql

CREATE FUNCTION public.runtime_process_validate_evidence_tenant_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  evidence_tenant_id TEXT;
BEGIN
  SELECT tenant_id
  INTO evidence_tenant_id
  FROM public.runtime_evidence
  WHERE evidence_id = NEW.evidence_id;

  IF evidence_tenant_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_process_evidence_links_evidence_fk',
      MESSAGE =
        'referenced runtime evidence does not exist';
  END IF;

  IF evidence_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_evidence_links_tenant_scope_check',
      MESSAGE =
        'runtime process evidence tenant scope mismatch';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_evidence_links_tenant_scope_guard
BEFORE INSERT
ON public.runtime_process_evidence_links
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_evidence_tenant_scope();

CREATE FUNCTION public.runtime_process_validate_transition_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  source_version_id UUID;
  target_version_id UUID;
BEGIN
  SELECT process_version_id
  INTO source_version_id
  FROM public.runtime_process_steps
  WHERE tenant_id = NEW.tenant_id
    AND process_step_id = NEW.source_step_id;

  SELECT process_version_id
  INTO target_version_id
  FROM public.runtime_process_steps
  WHERE tenant_id = NEW.tenant_id
    AND process_step_id = NEW.target_step_id;

  IF source_version_id IS DISTINCT FROM NEW.process_version_id
     OR target_version_id IS DISTINCT FROM NEW.process_version_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_transitions_version_scope_check',
      MESSAGE =
        'transition steps must belong to the declared process version';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_transitions_version_scope_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_transitions
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_transition_scope();

CREATE FUNCTION public.runtime_process_validate_definition_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  referenced_definition_id UUID;
  referenced_version_status TEXT;
BEGIN
  IF NEW.current_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    process_definition_id,
    version_status
  INTO
    referenced_definition_id,
    referenced_version_status
  FROM public.runtime_process_versions
  WHERE tenant_id = NEW.tenant_id
    AND process_version_id = NEW.current_version_id;

  IF referenced_definition_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_process_definitions_current_version_scope_fk',
      MESSAGE =
        'referenced current process version does not exist';
  END IF;

  IF referenced_definition_id <> NEW.process_definition_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_definitions_current_version_definition_check',
      MESSAGE =
        'current process version belongs to another definition';
  END IF;

  IF referenced_version_status <> 'published' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_definitions_current_version_status_check',
      MESSAGE =
        'current process version must be published';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_definitions_current_version_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_definitions
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_definition_current_version();

CREATE FUNCTION public.runtime_process_validate_instance_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  referenced_version_status TEXT;
  referenced_step_version_id UUID;
BEGIN
  SELECT version_status
  INTO referenced_version_status
  FROM public.runtime_process_versions
  WHERE tenant_id = NEW.tenant_id
    AND process_version_id = NEW.process_version_id;

  IF referenced_version_status IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_process_instances_version_scope_fk',
      MESSAGE =
        'referenced process version does not exist';
  END IF;

  IF referenced_version_status <> 'published' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_instances_published_version_check',
      MESSAGE =
        'process instances require a published process version';
  END IF;

  IF NEW.current_step_id IS NOT NULL THEN
    SELECT process_version_id
    INTO referenced_step_version_id
    FROM public.runtime_process_steps
    WHERE tenant_id = NEW.tenant_id
      AND process_step_id = NEW.current_step_id;

    IF referenced_step_version_id IS DISTINCT FROM NEW.process_version_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_instances_current_step_version_check',
        MESSAGE =
          'current process step belongs to another process version';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_instances_scope_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_instances
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_scope();

CREATE FUNCTION public.runtime_process_validate_step_instance_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  instance_version_id UUID;
  instance_status TEXT;
  step_version_id UUID;
BEGIN
  SELECT
    process_version_id,
    status
  INTO
    instance_version_id,
    instance_status
  FROM public.runtime_process_instances
  WHERE tenant_id = NEW.tenant_id
    AND process_instance_id = NEW.process_instance_id;

  IF instance_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_process_step_instances_instance_scope_fk',
      MESSAGE =
        'referenced process instance does not exist';
  END IF;

  IF instance_status IN ('completed', 'cancelled', 'failed') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_terminal_child_insert_check',
      MESSAGE =
        'terminal process instances cannot receive step instances';
  END IF;

  SELECT process_version_id
  INTO step_version_id
  FROM public.runtime_process_steps
  WHERE tenant_id = NEW.tenant_id
    AND process_step_id = NEW.process_step_id;

  IF step_version_id IS DISTINCT FROM instance_version_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_step_instances_version_scope_check',
      MESSAGE =
        'step instance step belongs to another process version';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_step_instances_scope_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_step_instances
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_step_instance_scope();

CREATE FUNCTION public.runtime_process_validate_assignment_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  referenced_instance_id UUID;
  referenced_instance_status TEXT;
BEGIN
  SELECT process_instance_id
  INTO referenced_instance_id
  FROM public.runtime_process_step_instances
  WHERE tenant_id = NEW.tenant_id
    AND process_step_instance_id = NEW.process_step_instance_id;

  IF referenced_instance_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_process_assignments_step_scope_fk',
      MESSAGE =
        'referenced process step instance does not exist';
  END IF;

  SELECT status
  INTO referenced_instance_status
  FROM public.runtime_process_instances
  WHERE tenant_id = NEW.tenant_id
    AND process_instance_id = referenced_instance_id;

  IF referenced_instance_status IN ('completed', 'cancelled', 'failed') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_terminal_child_insert_check',
      MESSAGE =
        'terminal process instances cannot receive assignments';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_assignments_scope_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_assignments
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_assignment_scope();

CREATE FUNCTION public.runtime_process_validate_instance_child_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  row_data JSONB;
  referenced_instance_id UUID;
  referenced_step_instance_id UUID;
  referenced_deadline_id UUID;
  step_parent_instance_id UUID;
  deadline_parent_instance_id UUID;
  referenced_instance_status TEXT;
  referenced_instance_object_id TEXT;
BEGIN
  row_data := to_jsonb(NEW);

  referenced_instance_id :=
    NULLIF(row_data ->> 'process_instance_id', '')::UUID;

  referenced_step_instance_id :=
    NULLIF(row_data ->> 'process_step_instance_id', '')::UUID;

  IF referenced_instance_id IS NOT NULL THEN
    SELECT
      status,
      object_id
    INTO
      referenced_instance_status,
      referenced_instance_object_id
    FROM public.runtime_process_instances
    WHERE tenant_id = NEW.tenant_id
      AND process_instance_id = referenced_instance_id;

    IF referenced_instance_status IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        CONSTRAINT =
          'runtime_process_child_instance_scope_check',
        MESSAGE =
          'referenced process instance does not exist';
    END IF;

    IF referenced_instance_status IN (
      'completed',
      'cancelled',
      'failed'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_terminal_child_insert_check',
        MESSAGE =
          'terminal process instances cannot receive dependent records';
    END IF;
  END IF;

  IF referenced_step_instance_id IS NOT NULL THEN
    IF referenced_instance_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_child_step_requires_instance_check',
        MESSAGE =
          'a step instance reference requires a process instance reference';
    END IF;

    SELECT process_instance_id
    INTO step_parent_instance_id
    FROM public.runtime_process_step_instances
    WHERE tenant_id = NEW.tenant_id
      AND process_step_instance_id = referenced_step_instance_id;

    IF step_parent_instance_id IS DISTINCT FROM referenced_instance_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_child_step_instance_scope_check',
        MESSAGE =
          'step instance belongs to another process instance';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'runtime_process_approval_requests'
     AND referenced_instance_id IS NOT NULL
     AND NULLIF(row_data ->> 'object_id', '')
         IS DISTINCT FROM referenced_instance_object_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_approval_requests_object_scope_check',
      MESSAGE =
        'approval request object does not match process instance object';
  END IF;

  IF TG_TABLE_NAME = 'runtime_process_escalations' THEN
    referenced_deadline_id :=
      NULLIF(row_data ->> 'process_deadline_id', '')::UUID;

    IF referenced_deadline_id IS NOT NULL THEN
      SELECT process_instance_id
      INTO deadline_parent_instance_id
      FROM public.runtime_process_deadlines
      WHERE tenant_id = NEW.tenant_id
        AND process_deadline_id = referenced_deadline_id;

      IF deadline_parent_instance_id
         IS DISTINCT FROM referenced_instance_id
      THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          CONSTRAINT =
            'runtime_process_escalations_deadline_instance_scope_check',
          MESSAGE =
            'deadline belongs to another process instance';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_evidence_links_instance_child_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_evidence_links
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_child_scope();

CREATE TRIGGER runtime_process_approval_requests_instance_child_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_approval_requests
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_child_scope();

CREATE TRIGGER runtime_process_deadlines_instance_child_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_deadlines
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_child_scope();

CREATE TRIGGER runtime_process_escalations_instance_child_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_escalations
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_child_scope();

CREATE TRIGGER runtime_process_commands_instance_child_guard
BEFORE INSERT
ON public.runtime_process_commands
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_instance_child_scope();

-- END MODULE: 220_tenant_scope_guards.sql

-- BEGIN MODULE: 230_immutability.sql
-- Module: 230_immutability.sql

CREATE FUNCTION public.runtime_process_reject_published_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  old_version_id UUID;
  new_version_id UUID;
  old_version_status TEXT;
  new_version_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'runtime_process_versions' THEN
    IF OLD.version_status IN ('published', 'retired') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_published_version_immutable_check',
        MESSAGE =
          'published or retired process versions are immutable';
    END IF;

    RETURN CASE
      WHEN TG_OP = 'DELETE' THEN OLD
      ELSE NEW
    END;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_version_id := OLD.process_version_id;

    SELECT version_status
    INTO old_version_status
    FROM public.runtime_process_versions
    WHERE tenant_id = OLD.tenant_id
      AND process_version_id = old_version_id;

    IF old_version_status IN ('published', 'retired') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_published_version_immutable_check',
        MESSAGE =
          'published or retired process versions are immutable';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_version_id := NEW.process_version_id;

    SELECT version_status
    INTO new_version_status
    FROM public.runtime_process_versions
    WHERE tenant_id = NEW.tenant_id
      AND process_version_id = new_version_id;

    IF new_version_status IN ('published', 'retired') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_published_version_immutable_check',
        MESSAGE =
          'published or retired process versions are immutable';
    END IF;
  END IF;

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END
$function$;

CREATE TRIGGER runtime_process_versions_immutability_guard
BEFORE UPDATE OR DELETE
ON public.runtime_process_versions
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_published_version_mutation();

CREATE TRIGGER runtime_process_steps_immutability_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.runtime_process_steps
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_published_version_mutation();

CREATE TRIGGER runtime_process_transitions_immutability_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.runtime_process_transitions
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_published_version_mutation();

CREATE FUNCTION public.runtime_process_validate_version_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  initial_step_count INTEGER;
BEGIN
  IF NEW.version_status = 'published'
     AND (
       TG_OP = 'INSERT'
       OR OLD.version_status IS DISTINCT FROM 'published'
     )
  THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_version_publish_via_update_check',
        MESSAGE =
          'process versions must be created as draft before publication';
    END IF;

    SELECT COUNT(*)
    INTO initial_step_count
    FROM public.runtime_process_steps
    WHERE tenant_id = NEW.tenant_id
      AND process_version_id = NEW.process_version_id
      AND is_initial = true;

    IF initial_step_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_process_versions_initial_step_cardinality_check',
        MESSAGE =
          'published process versions require exactly one initial step';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER runtime_process_versions_publication_guard
BEFORE INSERT OR UPDATE
ON public.runtime_process_versions
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_validate_version_publication();

CREATE FUNCTION public.runtime_process_reject_terminal_instance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status IN ('completed', 'cancelled', 'failed') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_process_instances_terminal_immutable_check',
      MESSAGE =
        'terminal process instances are immutable';
  END IF;

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END
$function$;

CREATE TRIGGER runtime_process_instances_terminal_guard
BEFORE UPDATE OR DELETE
ON public.runtime_process_instances
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_terminal_instance_mutation();

CREATE FUNCTION public.runtime_process_reject_append_only_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    CONSTRAINT =
      'runtime_process_append_only_check',
    MESSAGE =
      'runtime process journal records are append-only';
END
$function$;

CREATE TRIGGER runtime_process_evidence_links_append_only_guard
BEFORE UPDATE OR DELETE
ON public.runtime_process_evidence_links
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_append_only_mutation();

CREATE TRIGGER runtime_process_commands_append_only_guard
BEFORE UPDATE OR DELETE
ON public.runtime_process_commands
FOR EACH ROW
EXECUTE FUNCTION
  public.runtime_process_reject_append_only_mutation();

-- END MODULE: 230_immutability.sql

-- BEGIN MODULE: 240_comments.sql
-- Module: 240_comments.sql

COMMENT ON TABLE public.runtime_process_definitions IS
  'Tenant-scoped stable identities for RSOS business processes.';

COMMENT ON TABLE public.runtime_process_versions IS
  'Versioned process snapshots; published and retired versions are immutable.';

COMMENT ON TABLE public.runtime_process_steps IS
  'Version-scoped process step definitions.';

COMMENT ON TABLE public.runtime_process_transitions IS
  'Directed transitions between steps in one process version.';

COMMENT ON TABLE public.runtime_process_instances IS
  'Tenant-scoped executions of one published process version.';

COMMENT ON TABLE public.runtime_process_step_instances IS
  'Attempt-scoped runtime state for process steps.';

COMMENT ON TABLE public.runtime_process_assignments IS
  'Assignments of process step instances to actors, roles or resources.';

COMMENT ON TABLE public.runtime_process_evidence_links IS
  'Append-only links between process execution and runtime evidence.';

COMMENT ON TABLE public.runtime_process_approval_requests IS
  'Process approval requests optionally bound to governance decisions.';

COMMENT ON TABLE public.runtime_process_deadlines IS
  'Due dates and breach state for process instances and steps.';

COMMENT ON TABLE public.runtime_process_escalations IS
  'Escalation records raised from process execution or deadline breaches.';

COMMENT ON TABLE public.runtime_process_commands IS
  'Append-only idempotent command journal for the RSOS process runtime.';

-- END MODULE: 240_comments.sql

-- BEGIN MODULE: 990_verify.sql
-- Module: 990_verify.sql

DO $verify$
DECLARE
  missing_table_count INTEGER;
  missing_function_count INTEGER;
  missing_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing_table_count
  FROM (
    VALUES
      ('runtime_process_definitions'),
      ('runtime_process_versions'),
      ('runtime_process_steps'),
      ('runtime_process_transitions'),
      ('runtime_process_instances'),
      ('runtime_process_step_instances'),
      ('runtime_process_assignments'),
      ('runtime_process_evidence_links'),
      ('runtime_process_approval_requests'),
      ('runtime_process_deadlines'),
      ('runtime_process_escalations'),
      ('runtime_process_commands')
  ) AS required_tables(table_name)
  WHERE to_regclass(
    'public.' || required_tables.table_name
  ) IS NULL;

  IF missing_table_count <> 0 THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime process foundation table verification failed';
  END IF;

  SELECT COUNT(*)
  INTO missing_function_count
  FROM (
    VALUES
      ('runtime_process_validate_evidence_tenant_scope'),
      ('runtime_process_validate_transition_scope'),
      ('runtime_process_validate_definition_current_version'),
      ('runtime_process_validate_instance_scope'),
      ('runtime_process_validate_step_instance_scope'),
      ('runtime_process_validate_assignment_scope'),
      ('runtime_process_validate_instance_child_scope'),
      ('runtime_process_reject_published_version_mutation'),
      ('runtime_process_validate_version_publication'),
      ('runtime_process_reject_terminal_instance_mutation'),
      ('runtime_process_reject_append_only_mutation')
  ) AS required_functions(function_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = required_functions.function_name
  );

  IF missing_function_count <> 0 THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime process foundation function verification failed';
  END IF;

  SELECT COUNT(*)
  INTO missing_trigger_count
  FROM (
    VALUES
      ('runtime_process_evidence_links_tenant_scope_guard'),
      ('runtime_process_transitions_version_scope_guard'),
      ('runtime_process_definitions_current_version_guard'),
      ('runtime_process_instances_scope_guard'),
      ('runtime_process_step_instances_scope_guard'),
      ('runtime_process_assignments_scope_guard'),
      ('runtime_process_evidence_links_instance_child_guard'),
      ('runtime_process_approval_requests_instance_child_guard'),
      ('runtime_process_deadlines_instance_child_guard'),
      ('runtime_process_escalations_instance_child_guard'),
      ('runtime_process_commands_instance_child_guard'),
      ('runtime_process_versions_immutability_guard'),
      ('runtime_process_steps_immutability_guard'),
      ('runtime_process_transitions_immutability_guard'),
      ('runtime_process_versions_publication_guard'),
      ('runtime_process_instances_terminal_guard'),
      ('runtime_process_evidence_links_append_only_guard'),
      ('runtime_process_commands_append_only_guard')
  ) AS required_triggers(trigger_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = required_triggers.trigger_name
      AND NOT tgisinternal
  );

  IF missing_trigger_count <> 0 THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime process foundation trigger verification failed';
  END IF;
END
$verify$;

-- END MODULE: 990_verify.sql
SQL

mv "$TEMP_PATH" "$OUTPUT_PATH"
chmod 600 "$OUTPUT_PATH"

echo "BUILDER_RESULT=PASS"
echo "OUTPUT_PATH=$OUTPUT_PATH"
echo "OUTPUT_SHA256=$(sha256sum "$OUTPUT_PATH" | awk '{print $1}')"
