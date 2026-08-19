# RSOS-OC-001A-HM6 — Observation Cost Envelope Contract

Status: DRAFT
Scope: Architecture / Operational Care / Observation Cost
Change Class: Documentation Contract
Parent: RSOS-OC-001 Operational Care Foundation
Evidence Chain: RSOS-OC-001A-HM2 through HM8

Runtime Effects: NONE
Database Effects: NONE
Production Effects: NONE
Commit Authorization: NO

---

## 1. Purpose

This contract defines the first RSOS Observation Cost Envelope model.

Its purpose is to ensure that an observation is not treated as operationally
free merely because it is read-oriented or non-mutating.

An RSOS observer consumes resources.

Those costs must be:

1. identified;
2. measured where practical;
3. attributed to the correct causal scope;
4. interpreted in context;
5. separated from unknowns;
6. bounded before autonomous or repeated operational use.

The governing principle is:

> Observation has a cost.

A second governing principle is:

> Measurement without attribution is not causal knowledge.

A third governing principle is:

> The least invasive instrument capable of answering the question shall be
> preferred.

---

## 2. Relationship to Operational Care

This contract refines the RSOS-OC-001 Non-Invasive / Bounded Observation
metarule.

Operational Care shall distinguish:

Observation
-> Measurement
-> Attribution
-> Evidence
-> Baseline
-> Cost Envelope
-> Operational Budget
-> Runtime Enforcement

These states are not interchangeable.

In particular:

Measurement != Budget

Baseline != Authorized Limit

No value documented in this contract constitutes a production resource limit.

---

## 3. Cost Dimensions

The canonical Observation Cost Envelope dimensions are:

- CPU consumption;
- memory consumption;
- duration;
- logical filesystem activity;
- physical/block filesystem I/O;
- network activity;
- database connection/query activity;
- measurement overhead;
- human attention.

Physical energy consumption may later be added as a separately measured
dimension.

CPU time or resource utilization MUST NOT be represented as measured energy
in joules unless an appropriate physical energy measurement exists.

---

## 4. Context Requirement

Observation cost is context-dependent.

Therefore:

Cost = f(observation, context, time)

At minimum, relevant measurement evidence SHOULD identify:

- observation type;
- host/system scope;
- measurement time;
- repository or target scope where relevant;
- timeout;
- scheduling priority;
- I/O priority;
- host load context;
- memory context;
- storage context;
- measurement instrument;
- attribution scope.

A measurement without sufficient context MUST NOT silently become a universal
baseline.

---

## 5. Reference Observation

The first profiled reference observation is:

    git status --porcelain=v1

The bounded execution wrapper used during the controlled measurements was:

    timeout 10s nice -n 10 ionice -c 2 -n 7

The reference worktree was:

    /opt/rsos-worktrees/rsos-oc-001-operational-care

The measured host was in a low-load state during the recorded samples.

These facts constrain the applicability of the measurements.

---

## 6. HM2 Evidence

HM2 established the first bounded single observation sample.

Observed values included approximately:

- wall time: 0.01 seconds;
- externally measured duration: approximately 21.7 ms;
- user CPU: approximately 0.00 seconds;
- system CPU: approximately 0.01 seconds;
- maximum RSS: approximately 4992 KB;
- exit status: 0;
- observation output: 0 lines.

HM2 also verified availability of the host measurement tools required for
later profiling.

HM2 did NOT establish:

- physical energy consumption;
- causal database connection cost;
- causal network cost;
- a production budget.

---

## 7. HM3 Evidence

HM3 performed five controlled samples of the same reference observation.

The externally measured durations were approximately:

- 18.237 ms;
- 18.897 ms;
- 15.103 ms;
- 16.796 ms;
- 14.005 ms.

Derived sample properties:

- minimum: approximately 14.005 ms;
- maximum: approximately 18.897 ms;
- median: approximately 16.796 ms;
- range: approximately 4.892 ms.

Maximum RSS remained approximately within the 4.9 to 5.0 MiB region.

All five observations completed successfully.

This establishes a small reproducible baseline sample.

It does NOT establish a universal performance limit.

---

## 8. HM4 Measurement-Method Finding

HM4 attempted I/O attribution through /proc/self/io inside a measurement
wrapper.

The resulting deltas were zero.

Those values MUST NOT be interpreted as proof that the Git child process
performed no filesystem activity.

The method observed the parent shell's accounting scope and did not establish
correct child-process I/O attribution.

Therefore HM4 established the following methodological lesson:

> Measurement scope must match causal scope.

HM4 is retained as valid negative evidence about the measurement method.

The failed attribution method MUST NOT be promoted into a factual claim about
Git I/O behavior.

---

## 9. HM5 Capability Selection

HM5 verified availability of:

- pidstat;
- strace;
- perf;
- GNU time;
- timeout;
- nice;
- ionice;
- proc I/O accounting.

The host reported:

    perf_event_paranoid = 4

No kernel or permission setting was changed.

Method selection concluded:

- GNU time verbose: preferred first-line low-invasiveness resource instrument;
- pidstat: secondary instrument;
- strace: forensic/escalation instrument;
- perf: not selected for the normal measurement path;
- parent /proc/self/io: rejected for child attribution in this use case.

---

## 10. HM5B Direct Resource Evidence

HM5B directly profiled the bounded reference command using GNU time verbose.

Observed values included:

- elapsed wall time: approximately 0.01 seconds;
- external duration: approximately 18.648 ms;
- maximum RSS: 4992 KB;
- major page faults: 0;
- minor page faults: 520;
- voluntary context switches: 3;
- involuntary context switches: 2;
- filesystem inputs: 0;
- filesystem outputs: 0;
- socket messages sent: 0;
- socket messages received: 0;
- exit status: 0.

The observed duration is consistent with the HM3 sample range.

Filesystem input/output counters are accounting values and MUST NOT be
interpreted as proof of zero logical filesystem access.

Page cache and kernel metadata handling may satisfy logical filesystem
operations without attributed physical storage input.

---

## 10A. HM7 Comprehensive Observation Evidence

HM7 extended the single-observation evidence with a broader host-context
snapshot while preserving the distinction between command attribution and
host-level context.

The reference observation remained in the order of tens of milliseconds and
approximately 5 MiB maximum resident memory under the measured low-load
conditions.

HM7 additionally demonstrated that observation cost is state-dependent.
The observed repository state differed from earlier clean-reference samples,
and the resulting observation evidence differed accordingly.

Therefore:

    Observation Cost = f(observation, state, context, time)

Host-level before/after deltas MUST NOT be interpreted as causal attribution
to the observed command without an appropriate causal measurement method.

HM7 does not establish a production threshold or authorized resource budget.

---

## 10B. HM8 Multi-Worktree Stress Observation Evidence

HM8 extended the evidence scope from a single worktree to the real available
multi-worktree landscape using bounded serial observation.

Observed scope:

- worktrees: 11;
- clean: 4;
- changed: 7;
- failed: 0;
- aggregate external duration: approximately 319.270 ms;
- user CPU: approximately 0.06 seconds;
- system CPU: approximately 0.24 seconds;
- maximum RSS: 5248 KB;
- major page faults: 3;
- minor page faults: 15839;
- filesystem inputs: 4072 accounting units;
- filesystem outputs: 8 accounting units.

The test used bounded execution:

- global timeout: 30 seconds;
- per-worktree timeout: 5 seconds;
- maximum discovered worktrees: 100;
- serial execution only;
- low CPU priority;
- low best-effort I/O priority.

HM8 establishes evidence that total observation cost scales with active scope
and that individual observation cost varies with observed state and context.

The evidence supports the refined model:

    Total Observation Cost
      = sum(Individual Observation Cost)
      + Measurement / Orchestration Overhead

where each individual observation cost remains context-dependent.

This expression is an empirical resource-accounting model. It is not a
physical energy equation and does not establish joules or watts.

Filesystem accounting values MUST NOT be interpreted as file-level causal
proof. Host network or PostgreSQL snapshots likewise MUST NOT be promoted into
causal command attribution.

HM8 does not establish a universal maximum, production threshold, operational
budget, or authorization for runtime enforcement.

---

## 11. Current Evidence Classification

For the reference observation:

### Duration

Status: VERIFIED_BASELINE_SAMPLE

Evidence:
HM2, HM3 and HM5B provide mutually compatible short-duration measurements.

No production limit is authorized.

### CPU

Status: VERIFIED_SAMPLE

CPU consumption has been observed through GNU time-based measurements.

No energy value may be inferred from CPU percentage alone.

### Memory

Status: VERIFIED_SAMPLE

Maximum resident memory was repeatedly observed around 5 MiB.

No universal maximum is established.

### Physical Filesystem I/O

Status: VERIFIED_SAMPLE_NO_ACCOUNTED_INPUT_OUTPUT

HM5B reported zero filesystem input/output accounting for the sampled run.

This statement is limited to the accounting scope of that run.

### Logical Filesystem Activity

Status: UNKNOWN

No syscall-level trace has been executed.

Zero physical input does not prove zero logical filesystem access.

### Network Activity

Status: NO_ACTIVITY_OBSERVED_IN_REFERENCE_SAMPLE

HM5B reported zero socket messages for the measured command.

This is not promoted into a universal prohibition or guarantee.

### Database Activity

Status: UNKNOWN

Previous PostgreSQL process snapshots do not establish causal database usage
by the reference observation.

### Physical Energy

Status: NOT_MEASURED

No joule or watt measurement has been performed.

### Human Attention

Status: SEPARATE_DIMENSION

Human attention is an operational and cognitive resource.

It MUST NOT be represented as physical energy.

---

## 12. Observation Cost Envelope

The canonical conceptual envelope is:

    OCE = {
        CPU,
        MEMORY,
        DURATION,
        LOGICAL_FILESYSTEM,
        PHYSICAL_IO,
        NETWORK,
        DATABASE,
        MEASUREMENT_OVERHEAD,
        HUMAN_ATTENTION
    }

An optional future physical-energy dimension may be added only when measured
through a suitable evidence path.

The envelope MUST preserve UNKNOWN values.

UNKNOWN MUST NOT be converted to zero.

---

## 13. Baseline versus Budget

A baseline describes observed behavior.

A budget defines authorized resource consumption.

Therefore:

    Baseline != Budget

and:

    Observed Maximum != Authorized Maximum

No operational budget may be derived from a single measurement or an
insufficiently representative sample without explicit review.

Budgets SHOULD consider:

- normal load;
- elevated load;
- repository/target growth;
- cache state;
- concurrent activity;
- measurement variance;
- failure behavior;
- timeout behavior;
- safety margin;
- observer frequency.

---

## 14. Observer Effect

Measurement itself consumes resources.

RSOS SHALL therefore treat measurement overhead as part of the evidence model.

A more invasive measurement instrument SHALL NOT automatically be preferred
merely because it provides more detail.

The selection principle is:

> Use the least invasive instrument capable of answering the operational
> question with sufficient confidence.

Forensic tracing is an escalation mechanism, not the default observer mode.

---

## 15. Repetition and Frequency

A low-cost observation can become expensive through repetition.

Therefore total observation cost depends on both per-observation cost and
frequency.

Conceptually:

    Total Observation Cost
      = Per Observation Cost
      x Observation Frequency
      x Active Scope

This expression is a resource-accounting model, not a physical energy
equation.

Observation frequency MUST therefore be considered before any observer is
scheduled or automated.

---

## 16. Unknown Preservation

RSOS SHALL preserve unresolved cost dimensions explicitly.

The following are forbidden:

- UNKNOWN -> 0 without evidence;
- no observed I/O -> no filesystem access;
- no observed network activity -> network impossible;
- CPU utilization -> joules without energy measurement;
- host snapshot -> causal process attribution;
- baseline -> production budget without authorization.

---

## 17. Cost Envelope Lifecycle

A future Observation Cost Envelope may progress through:

    DRAFT
    -> MEASURED
    -> ATTRIBUTED
    -> BASELINED
    -> REVIEWED
    -> BUDGET_PROPOSED
    -> HUMAN_APPROVED
    -> ENFORCEABLE

A transition MUST NOT be skipped merely because measurements appear benign.

Runtime enforcement requires separate authorization.

---

## 18. Operational Care Consequence

An observer that exceeds its approved future cost envelope must not silently
continue at unlimited frequency or scope.

Future responses may include:

- reduce observation frequency;
- reduce observation scope;
- defer non-critical observation;
- degrade to a cheaper observation method;
- mark the observation state UNKNOWN;
- escalate for human review.

These are architectural possibilities only.

No runtime behavior is authorized by this document.

---

## 19. Evidence Integrity

Every future cost claim SHOULD be traceable to:

- measurement method;
- measurement scope;
- observation identity;
- timestamp;
- context;
- raw result or retained evidence;
- interpretation;
- known limitations.

A measurement result and its interpretation SHALL remain distinguishable.

---

## 20. Current Decision

The current reference observation has sufficient evidence for a preliminary
baseline description.

It does not yet have sufficient evidence for a universal operational budget.

Therefore:

    REFERENCE_OBSERVATION_BASELINE = PARTIALLY_VERIFIED
    OBSERVATION_COST_ENVELOPE_MODEL = DEFINED
    OPERATIONAL_BUDGET = NOT_AUTHORIZED
    RUNTIME_ENFORCEMENT = NOT_AUTHORIZED

---

## 21. Authority Boundary

RSOS_OC_001A_HM6_DOCUMENTATION_DRAFT_AUTHORIZED = YES
RSOS_OC_001A_HM6_COMMIT_AUTHORIZED = NO
RSOS_OC_001A_HM6_RUNTIME_CHANGE_AUTHORIZED = NO
RSOS_OC_001A_HM6_DATABASE_CHANGE_AUTHORIZED = NO
RSOS_OC_001A_HM6_PRODUCTION_CHANGE_AUTHORIZED = NO
RSOS_OC_001A_HM6_BUDGET_AUTHORIZED = NO

---

## 22. Closing Principle

Operational observation is not free.

RSOS shall understand the cost of observing before turning observation into
continuous automated behavior.

The governing chain is:

    Observe
    -> Measure
    -> Attribute
    -> Preserve Unknowns
    -> Establish Baseline
    -> Propose Envelope
    -> Review
    -> Authorize Budget
    -> Enforce Safely

No later stage is implied merely because an earlier stage succeeded.
