async function handleEvidenceGovernanceRoute({
  req,
  res,
  path,
  db,
  crypto,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
    if (req.method === "POST" && path === "/runtime/source-quality") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const source_id = body.source_id || null;
      const quality_dimension = body.quality_dimension;
      const rating = body.rating || null;
      const assessment_notes = body.assessment_notes || null;
      const assessed_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!quality_dimension) {
        return send(res, 400, {
          error: "validation_error",
          message: "quality_dimension required"
        });
      }

      const source_quality_id =
        "00000000-0000-4011-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_source_quality (
          source_quality_id,
          tenant_id,
          source_id,
          quality_dimension,
          rating,
          assessment_notes,
          assessed_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        source_quality_id,
        tenant_id,
        source_id,
        quality_dimension,
        rating,
        assessment_notes,
        assessed_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_quality_id,
        event_type: "runtime.source_quality.created",
        message: JSON.stringify({
          source_quality_id,
          source_id,
          quality_dimension,
          rating
        })
      });

      return send(res, 201, {
        source_quality: {
          source_quality_id,
          tenant_id,
          source_id,
          quality_dimension,
          rating,
          assessment_notes,
          assessed_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/source-quality") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          q.source_quality_id,
          q.tenant_id,
          q.source_id,
          s.title AS source_title,
          s.source_type,
          q.quality_dimension,
          q.rating,
          q.assessment_notes,
          q.assessed_at,
          q.assessed_by
        FROM runtime_source_quality q
        LEFT JOIN runtime_sources s
          ON s.source_id = q.source_id
        WHERE q.tenant_id = $1
        ORDER BY q.assessed_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        source_quality: result.rows
      });
    }

    if (req.method === "POST" && path === "/runtime/source-conflicts") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const source_id_a = body.source_id_a || null;
      const source_id_b = body.source_id_b || null;
      const conflict_type = body.conflict_type;
      const description = body.description || null;
      const status = body.status || "open";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!conflict_type) {
        return send(res, 400, {
          error: "validation_error",
          message: "conflict_type required"
        });
      }

      const conflict_id =
        "00000000-0000-4012-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_source_conflicts (
          conflict_id,
          tenant_id,
          source_id_a,
          source_id_b,
          conflict_type,
          description,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        conflict_id,
        tenant_id,
        source_id_a,
        source_id_b,
        conflict_type,
        description,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: conflict_id,
        event_type: "runtime.source_conflict.created",
        message: JSON.stringify({
          conflict_id,
          source_id_a,
          source_id_b,
          conflict_type,
          status
        })
      });

      return send(res, 201, {
        source_conflict: {
          conflict_id,
          tenant_id,
          source_id_a,
          source_id_b,
          conflict_type,
          description,
          status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/source-conflicts") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          c.conflict_id,
          c.tenant_id,
          c.source_id_a,
          sa.title AS source_a_title,
          c.source_id_b,
          sb.title AS source_b_title,
          c.conflict_type,
          c.description,
          c.status,
          c.created_at,
          c.created_by
        FROM runtime_source_conflicts c
        LEFT JOIN runtime_sources sa
          ON sa.source_id = c.source_id_a
        LEFT JOIN runtime_sources sb
          ON sb.source_id = c.source_id_b
        WHERE c.tenant_id = $1
        ORDER BY c.created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        source_conflicts: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/fact-acceptance-rules") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const rule_name = body.rule_name;
      const minimum_verification_confidence = body.minimum_verification_confidence || null;
      const minimum_source_quality = body.minimum_source_quality || null;
      const minimum_evidence_count = body.minimum_evidence_count || null;
      const maximum_open_unknowns = body.maximum_open_unknowns === undefined ? null : body.maximum_open_unknowns;
      const maximum_open_conflicts = body.maximum_open_conflicts === undefined ? null : body.maximum_open_conflicts;
      const enabled = body.enabled === false ? false : true;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!rule_name) {
        return send(res, 400, {
          error: "validation_error",
          message: "rule_name required"
        });
      }

      const rule_id =
        "00000000-0000-4013-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_fact_acceptance_rules (
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        rule_id,
        tenant_id,
        rule_name,
        minimum_verification_confidence,
        minimum_source_quality,
        minimum_evidence_count,
        maximum_open_unknowns,
        maximum_open_conflicts,
        enabled,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: rule_id,
        event_type: "runtime.fact_acceptance_rule.created",
        message: JSON.stringify({
          rule_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled
        })
      });

      return send(res, 201, {
        fact_acceptance_rule: {
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/fact-acceptance-rules") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          rule_id,
          tenant_id,
          rule_name,
          minimum_verification_confidence,
          minimum_source_quality,
          minimum_evidence_count,
          maximum_open_unknowns,
          maximum_open_conflicts,
          enabled,
          created_at,
          created_by
        FROM runtime_fact_acceptance_rules
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        fact_acceptance_rules: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/validate") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const factResult = await db.query(`
        SELECT
          f.fact_id,
          f.verification_result_id,
          vr.result_status,
          vr.confidence,
          vr.accepted_as_fact
        FROM runtime_facts f
        JOIN runtime_verification_results vr
          ON vr.result_id = f.verification_result_id
        WHERE f.tenant_id = $1
          AND f.fact_id = $2
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (factResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "fact not found"
        });
      }

      const ruleResult = await db.query(`
        SELECT *
        FROM runtime_fact_acceptance_rules
        WHERE tenant_id = $1
          AND enabled = true
        ORDER BY created_at DESC
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (ruleResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "no active fact acceptance rule found"
        });
      }

      const rule = ruleResult.rows[0];
      const fact = factResult.rows[0];

      const unknownResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_unknowns
        WHERE tenant_id = $1
          AND related_object_type = 'fact'
          AND related_object_id = $2
          AND status = 'open'
      `, [
        tenant_id,
        fact_id
      ]);

      const conflictResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_source_conflicts
        WHERE tenant_id = $1
          AND status = 'open'
      `, [
        tenant_id
      ]);

      const evidenceResult = await db.query(`
        SELECT COUNT(DISTINCT evidence_id)::int AS count
        FROM (
          SELECT fs.evidence_id
          FROM runtime_fact_sources fs
          WHERE fs.tenant_id = $1
            AND fs.fact_id = $2

          UNION

          SELECT a.evidence_id
          FROM runtime_facts f
          LEFT JOIN runtime_verification_results vr
            ON vr.tenant_id = f.tenant_id
           AND vr.result_id = f.verification_result_id
          LEFT JOIN runtime_verifications v
            ON v.tenant_id = f.tenant_id
           AND v.verification_id = vr.verification_id
          LEFT JOIN runtime_verification_cycles vc
            ON vc.tenant_id = f.tenant_id
           AND (
                vc.verification_result_id = vr.result_id
                OR vc.fact_id = f.fact_id
                OR vc.hypothesis_id = v.hypothesis_id
              )
          LEFT JOIN runtime_hypotheses h
            ON h.tenant_id = f.tenant_id
           AND h.hypothesis_id = COALESCE(vc.hypothesis_id, v.hypothesis_id)
          LEFT JOIN runtime_assumptions a
            ON a.tenant_id = f.tenant_id
           AND a.assumption_id = COALESCE(h.assumption_id, vc.assumption_id)
          WHERE f.tenant_id = $1
            AND f.fact_id = $2
            AND a.evidence_id IS NOT NULL
        ) evidence_links
      `, [
        tenant_id,
        fact_id
      ]);

      const qualityResult = await db.query(`
        SELECT AVG(rating)::numeric(5,2) AS avg_rating
        FROM runtime_source_quality
        WHERE tenant_id = $1
      `, [
        tenant_id
      ]);

      const verificationConfidence = Number(fact.confidence || 0);
      const sourceQuality = Number(qualityResult.rows[0].avg_rating || 0);
      const evidenceCount = Number(evidenceResult.rows[0].count || 0);
      const openUnknowns = Number(unknownResult.rows[0].count || 0);
      const openConflicts = Number(conflictResult.rows[0].count || 0);

      const checks = {
        accepted_as_fact:
          fact.accepted_as_fact === true,

        verification_confidence:
          verificationConfidence >= Number(rule.minimum_verification_confidence || 0),

        source_quality:
          sourceQuality >= Number(rule.minimum_source_quality || 0),

        evidence_count:
          evidenceCount >= Number(rule.minimum_evidence_count || 0),

        open_unknowns:
          openUnknowns <= Number(rule.maximum_open_unknowns ?? 999999),

        open_conflicts:
          openConflicts <= Number(rule.maximum_open_conflicts ?? 999999)
      };

      const reasonMap = {
        accepted_as_fact: "verification_result_not_accepted_as_fact",
        verification_confidence: "minimum_verification_confidence_not_met",
        source_quality: "minimum_source_quality_not_met",
        evidence_count: "minimum_evidence_count_not_met",
        open_unknowns: "maximum_open_unknowns_exceeded",
        open_conflicts: "maximum_open_conflicts_exceeded"
      };

      const reasons = [];

      Object.entries(checks).forEach(([key, passed]) => {
        if (!passed) {
          reasons.push(reasonMap[key] || key);
        }
      });

      const accepted = reasons.length === 0;

      const score =
        Object.values(checks).filter(Boolean).length /
        Object.keys(checks).length;

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.validation.completed",
        message: JSON.stringify({
          fact_id,
          accepted,
          score,
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          reasons
        })
      });

      return send(res, 200, {
        accepted,
        score,
        fact_id,
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        metrics: {
          verification_confidence: verificationConfidence,
          source_quality: sourceQuality,
          evidence_count: evidenceCount,
          open_unknowns: openUnknowns,
          open_conflicts: openConflicts
        },
        checks,
        reasons
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/calculate-confidence") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;
      const calculated_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const factResult = await db.query(`
        SELECT
          f.fact_id,
          f.verification_result_id,
          vr.confidence AS verification_confidence,
          vr.accepted_as_fact
        FROM runtime_facts f
        LEFT JOIN runtime_verification_results vr
          ON vr.result_id = f.verification_result_id
        WHERE f.tenant_id = $1
          AND f.fact_id = $2
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (factResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "fact not found"
        });
      }

      const qualityResult = await db.query(`
        SELECT AVG(rating)::numeric(5,2) AS avg_rating
        FROM runtime_source_quality
        WHERE tenant_id = $1
      `, [
        tenant_id
      ]);

      const evidenceResult = await db.query(`
        SELECT COUNT(DISTINCT evidence_id)::int AS count
        FROM (
          SELECT fs.evidence_id
          FROM runtime_fact_sources fs
          WHERE fs.tenant_id = $1
            AND fs.fact_id = $2

          UNION

          SELECT a.evidence_id
          FROM runtime_facts f
          LEFT JOIN runtime_verification_results vr
            ON vr.tenant_id = f.tenant_id
           AND vr.result_id = f.verification_result_id
          LEFT JOIN runtime_verifications v
            ON v.tenant_id = f.tenant_id
           AND v.verification_id = vr.verification_id
          LEFT JOIN runtime_verification_cycles vc
            ON vc.tenant_id = f.tenant_id
           AND (
                vc.verification_result_id = vr.result_id
                OR vc.fact_id = f.fact_id
                OR vc.hypothesis_id = v.hypothesis_id
              )
          LEFT JOIN runtime_hypotheses h
            ON h.tenant_id = f.tenant_id
           AND h.hypothesis_id = COALESCE(vc.hypothesis_id, v.hypothesis_id)
          LEFT JOIN runtime_assumptions a
            ON a.tenant_id = f.tenant_id
           AND a.assumption_id = COALESCE(h.assumption_id, vc.assumption_id)
          WHERE f.tenant_id = $1
            AND f.fact_id = $2
            AND a.evidence_id IS NOT NULL
        ) evidence_links
      `, [
        tenant_id,
        fact_id
      ]);

      const unknownResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_unknowns
        WHERE tenant_id = $1
          AND related_object_type = 'fact'
          AND related_object_id = $2
          AND status = 'open'
      `, [
        tenant_id,
        fact_id
      ]);

      const conflictResult = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM runtime_source_conflicts
        WHERE tenant_id = $1
          AND status = 'open'
      `, [
        tenant_id
      ]);

      const verificationConfidence =
        Number(factResult.rows[0].verification_confidence || 0);

      const sourceQuality =
        Number(qualityResult.rows[0].avg_rating || 0);

      const evidenceCount =
        Number(evidenceResult.rows[0].count || 0);

      const openUnknowns =
        Number(unknownResult.rows[0].count || 0);

      const openConflicts =
        Number(conflictResult.rows[0].count || 0);

      const evidenceFactor =
        Math.min(1, evidenceCount / 3);

      const unknownPenalty =
        Math.min(0.50, openUnknowns * 0.10);

      const conflictPenalty =
        Math.min(0.50, openConflicts * 0.15);

      const verificationFactor =
        verificationConfidence / 100;

      const sourceQualityFactor =
        sourceQuality / 100;

      let confidenceScore =
        (verificationFactor * 0.45) +
        (sourceQualityFactor * 0.30) +
        (evidenceFactor * 0.25) -
        unknownPenalty -
        conflictPenalty;

      confidenceScore =
        Math.max(0, Math.min(1, confidenceScore));

      confidenceScore =
        Math.round(confidenceScore * 100) / 100;

      let trustLevel = "VERY_LOW";

      if (confidenceScore >= 0.90) {
        trustLevel = "VERY_HIGH";
      } else if (confidenceScore >= 0.75) {
        trustLevel = "HIGH";
      } else if (confidenceScore >= 0.50) {
        trustLevel = "MEDIUM";
      } else if (confidenceScore >= 0.25) {
        trustLevel = "LOW";
      }

      const confidence_id =
        "00000000-0000-4014-8000-" +
        crypto.randomBytes(6).toString("hex");

      const calculationDetails = {
        formula: "verification*0.45 + source_quality*0.30 + evidence_factor*0.25 - unknown_penalty - conflict_penalty",
        verification_confidence: verificationConfidence,
        source_quality: sourceQuality,
        evidence_count: evidenceCount,
        evidence_factor: evidenceFactor,
        open_unknowns: openUnknowns,
        unknown_penalty: unknownPenalty,
        open_conflicts: openConflicts,
        conflict_penalty: conflictPenalty,
        confidence_score: confidenceScore,
        trust_level: trustLevel
      };

      await db.query(`
        INSERT INTO runtime_fact_confidence (
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details,
          calculated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        confidence_id,
        tenant_id,
        fact_id,
        confidenceScore,
        trustLevel,
        JSON.stringify(calculationDetails),
        calculated_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.confidence.calculated",
        message: JSON.stringify({
          confidence_id,
          fact_id,
          confidence_score: confidenceScore,
          trust_level: trustLevel
        })
      });

      return send(res, 201, {
        fact_confidence: {
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score: confidenceScore,
          trust_level: trustLevel,
          calculation_details: calculationDetails,
          calculated_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/fact-confidence") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          confidence_id,
          tenant_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details,
          calculated_at,
          calculated_by
        FROM runtime_fact_confidence
        WHERE tenant_id = $1
        ORDER BY calculated_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        fact_confidence: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/facts/governance-check") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const fact_id = body.fact_id;
      const checked_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !fact_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and fact_id required"
        });
      }

      const confidenceResult = await db.query(`
        SELECT
          confidence_id,
          fact_id,
          confidence_score,
          trust_level,
          calculation_details
        FROM runtime_fact_confidence
        WHERE tenant_id = $1
          AND fact_id = $2
        ORDER BY calculated_at DESC
        LIMIT 1
      `, [
        tenant_id,
        fact_id
      ]);

      if (confidenceResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "no confidence calculation found for fact"
        });
      }

      const confidence = confidenceResult.rows[0];
      const trust_level = confidence.trust_level;

      let governance_decision = "investigate";
      let human_approval_required = true;
      let decision_reason = "LOW or unknown trust requires investigation";

      if (trust_level === "VERY_HIGH") {
        governance_decision = "auto_approve";
        human_approval_required = false;
        decision_reason = "VERY_HIGH trust allows automatic approval";
      } else if (trust_level === "HIGH") {
        governance_decision = "approve";
        human_approval_required = false;
        decision_reason = "HIGH trust allows standard approval";
      } else if (trust_level === "MEDIUM") {
        governance_decision = "four_eyes_required";
        human_approval_required = true;
        decision_reason = "MEDIUM trust requires four-eyes approval";
      } else if (trust_level === "LOW") {
        governance_decision = "investigate";
        human_approval_required = true;
        decision_reason = "LOW trust requires further investigation";
      } else if (trust_level === "VERY_LOW") {
        governance_decision = "quarantine";
        human_approval_required = true;
        decision_reason = "VERY_LOW trust requires quarantine";
      }

      const governance_check_id =
        "00000000-0000-4015-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_governance_checks (
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        governance_check_id,
        tenant_id,
        fact_id,
        confidence.confidence_id,
        trust_level,
        governance_decision,
        human_approval_required,
        decision_reason,
        checked_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id,
        event_type: "runtime.fact.governance.checked",
        message: JSON.stringify({
          governance_check_id,
          fact_id,
          confidence_id: confidence.confidence_id,
          trust_level,
          governance_decision,
          human_approval_required
        })
      });

      return send(res, 201, {
        governance_check: {
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id: confidence.confidence_id,
          confidence_score: confidence.confidence_score,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/governance-checks") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          governance_check_id,
          tenant_id,
          fact_id,
          confidence_id,
          trust_level,
          governance_decision,
          human_approval_required,
          decision_reason,
          checked_at,
          checked_by
        FROM runtime_governance_checks
        WHERE tenant_id = $1
        ORDER BY checked_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        governance_checks: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/governance-outcomes") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const governance_check_id = body.governance_check_id || null;
      const fact_id = body.fact_id || null;
      const outcome_status = body.outcome_status;
      const outcome_correct = body.outcome_correct === undefined ? null : body.outcome_correct;
      const outcome_notes = body.outcome_notes || null;
      const outcome_date = body.outcome_date || null;
      const recorded_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!outcome_status) {
        return send(res, 400, {
          error: "validation_error",
          message: "outcome_status required"
        });
      }

      const outcome_id =
        "00000000-0000-4016-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_governance_outcomes (
          outcome_id,
          tenant_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct,
          outcome_notes,
          outcome_date,
          recorded_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, NOW()),$9)
      `, [
        outcome_id,
        tenant_id,
        governance_check_id,
        fact_id,
        outcome_status,
        outcome_correct,
        outcome_notes,
        outcome_date,
        recorded_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: fact_id || governance_check_id || outcome_id,
        event_type: "runtime.governance_outcome.recorded",
        message: JSON.stringify({
          outcome_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct
        })
      });

      return send(res, 201, {
        governance_outcome: {
          outcome_id,
          tenant_id,
          governance_check_id,
          fact_id,
          outcome_status,
          outcome_correct,
          outcome_notes,
          outcome_date,
          recorded_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/governance-outcomes") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          o.outcome_id,
          o.tenant_id,
          o.governance_check_id,
          o.fact_id,
          gc.trust_level,
          gc.governance_decision,
          o.outcome_status,
          o.outcome_correct,
          o.outcome_notes,
          o.outcome_date,
          o.recorded_at,
          o.recorded_by
        FROM runtime_governance_outcomes o
        LEFT JOIN runtime_governance_checks gc
          ON gc.governance_check_id = o.governance_check_id
        WHERE o.tenant_id = $1
        ORDER BY o.recorded_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        governance_outcomes: result.rows
      });
    }


    if (req.method === "POST" && path === "/runtime/lessons-learned/generate") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const outcome_id = body.outcome_id;
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id || !outcome_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id and outcome_id required"
        });
      }

      const outcomeResult = await db.query(`
        SELECT
          o.outcome_id,
          o.tenant_id,
          o.fact_id,
          o.governance_check_id,
          o.outcome_status,
          o.outcome_correct,
          o.outcome_notes,
          gc.trust_level,
          gc.governance_decision
        FROM runtime_governance_outcomes o
        LEFT JOIN runtime_governance_checks gc
          ON gc.governance_check_id = o.governance_check_id
        WHERE o.tenant_id = $1
          AND o.outcome_id = $2
        LIMIT 1
      `, [
        tenant_id,
        outcome_id
      ]);

      if (outcomeResult.rows.length === 0) {
        return send(res, 404, {
          error: "not_found",
          message: "governance outcome not found"
        });
      }

      const outcome = outcomeResult.rows[0];

      let lesson_type = "governance_feedback";
      let lesson_summary = "Governance outcome recorded.";
      let recommended_action = "Review governance outcome manually.";

      if (outcome.outcome_correct === true) {
        if (outcome.trust_level === "LOW" && outcome.governance_decision === "investigate") {
          lesson_type = "trust_validation";
          lesson_summary = "LOW trust correctly triggered investigation.";
          recommended_action = "Keep current LOW trust investigation threshold.";
        } else if (outcome.trust_level === "VERY_LOW" && outcome.governance_decision === "quarantine") {
          lesson_type = "trust_validation";
          lesson_summary = "VERY_LOW trust correctly triggered quarantine.";
          recommended_action = "Keep current VERY_LOW quarantine threshold.";
        } else if ((outcome.trust_level === "HIGH" || outcome.trust_level === "VERY_HIGH") && outcome.governance_decision.includes("approve")) {
          lesson_type = "trust_validation";
          lesson_summary = "High trust correctly supported approval.";
          recommended_action = "Keep current approval threshold.";
        } else if (outcome.trust_level === "MEDIUM" && outcome.governance_decision === "four_eyes_required") {
          lesson_type = "trust_validation";
          lesson_summary = "MEDIUM trust correctly required four-eyes review.";
          recommended_action = "Keep current MEDIUM four-eyes threshold.";
        }
      } else if (outcome.outcome_correct === false) {
        if (outcome.trust_level === "HIGH" || outcome.trust_level === "VERY_HIGH") {
          lesson_type = "false_positive";
          lesson_summary = "High trust decision produced incorrect outcome.";
          recommended_action = "Lower trust weighting or require additional verification for similar cases.";
        } else if (outcome.trust_level === "LOW" || outcome.trust_level === "VERY_LOW") {
          lesson_type = "false_negative";
          lesson_summary = "Low trust assessment may have underestimated a correct outcome.";
          recommended_action = "Review penalty weights and evidence factors for similar cases.";
        } else {
          lesson_type = "governance_miscalibration";
          lesson_summary = "Governance decision produced incorrect outcome.";
          recommended_action = "Review governance rule calibration.";
        }
      }

      const lesson_id =
        "00000000-0000-4017-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_lessons_learned (
          lesson_id,
          tenant_id,
          outcome_id,
          fact_id,
          trust_level,
          governance_decision,
          outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        lesson_id,
        tenant_id,
        outcome.outcome_id,
        outcome.fact_id,
        outcome.trust_level,
        outcome.governance_decision,
        outcome.outcome_correct,
        lesson_type,
        lesson_summary,
        recommended_action,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: outcome.fact_id || outcome.outcome_id,
        event_type: "runtime.lesson_learned.generated",
        message: JSON.stringify({
          lesson_id,
          outcome_id,
          fact_id: outcome.fact_id,
          trust_level: outcome.trust_level,
          governance_decision: outcome.governance_decision,
          outcome_correct: outcome.outcome_correct,
          lesson_type
        })
      });

      return send(res, 201, {
        lesson_learned: {
          lesson_id,
          tenant_id,
          outcome_id: outcome.outcome_id,
          fact_id: outcome.fact_id,
          trust_level: outcome.trust_level,
          governance_decision: outcome.governance_decision,
          outcome_correct: outcome.outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/lessons-learned") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id = authUser.tenant_id;

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const result = await db.query(`
        SELECT
          lesson_id,
          tenant_id,
          outcome_id,
          fact_id,
          trust_level,
          governance_decision,
          outcome_correct,
          lesson_type,
          lesson_summary,
          recommended_action,
          created_at,
          created_by
        FROM runtime_lessons_learned
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        lessons_learned: result.rows
      });
    }


  return false;
}

module.exports = {
  handleEvidenceGovernanceRoute
};
