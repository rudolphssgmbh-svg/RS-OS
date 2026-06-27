#!/usr/bin/env bash
set -euo pipefail

echo "RSOS TIR Full Validation Run"
echo "Started: $(date -Iseconds)"
echo

tests/tir/rsos_tir_0111a_tabula_rasa_check.sh
echo

tests/tir/rsos_tir_0111a_drift_simulation.sh
echo

tests/tir/rsos_tir_0111b_feedback_loop.sh
echo

tests/tir/rsos_tir_0110a_competency_formation.sh
echo

tests/tir/rsos_tir_0108_adaptation_trigger.sh
echo

echo "PASS: All RSOS TIR validation scripts completed successfully."
echo "Finished: $(date -Iseconds)"
